/**
 * Runners de sync ERP → PLM reutilizáveis.
 *
 * São usados:
 *  - pelos createServerFn em `erp-import.functions.ts` (com supabase do usuário, RLS aplicada),
 *  - pela rota pública `/api/public/hooks/erp-pull-all` (com supabaseAdmin, escopo manual por owner_id).
 *
 * A assinatura é sempre `(supabase, userId)`. Quando vier do admin, o userId
 * substitui auth.uid() em todas as queries — basta filtrar/setar owner_id corretamente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { usesoftQuery } from "@/integrations/usesoft/client.server";

type SB = SupabaseClient<Database>;
const ERP_SOURCE = "usesoft";

type CollectionUpdate = Database["public"]["Tables"]["collections"]["Update"];
type CollectionStatus = Database["public"]["Enums"]["collection_status"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductStatus = Database["public"]["Enums"]["product_status"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

async function logErr(sb: SB, userId: string, entity: string, ref: string, msg: string) {
  await sb.from("erp_sync_log").insert({
    owner_id: userId, direction: "in", event_type: "sync",
    entity_type: entity, entity_ref: ref,
    status: "error", records_affected: 0, error_message: msg,
  });
}
async function logOk(sb: SB, userId: string, entity: string, ref: string, n: number, payload: Record<string, unknown>) {
  await sb.from("erp_sync_log").insert({
    owner_id: userId, direction: "in", event_type: "sync",
    entity_type: entity, entity_ref: ref,
    status: "success", records_affected: n, payload: payload as never,
  });
}

/** Roda `task` para cada item de `items` com até `concurrency` em paralelo. */
async function mapPool<T, R>(items: T[], concurrency: number, task: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      ret[idx] = await task(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return ret;
}

// ---------------------------------------------------------------- COLLECTIONS
export async function runSyncCollections(supabase: SB, userId: string) {
  const startedAt = new Date().toISOString();
  let erpRows: Array<{ nnumerogrife: number | string; cdescrigrife: string; cstatusgrife: string | null }> = [];
  try {
    const r = await usesoftQuery<typeof erpRows[number]>(
      `SELECT nnumerogrife, cdescrigrife, cstatusgrife FROM solgrife ORDER BY cdescrigrife`,
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "collections", "solgrife", msg);
    throw new Error(msg);
  }
  const { data: existing } = await supabase
    .from("collections").select("id, erp_id, name, status")
    .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
  const byErp = new Map((existing ?? []).map((c) => [String(c.erp_id), c]));
  let inserted = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const row of erpRows) {
    const erpId = String(row.nnumerogrife);
    const nome = String(row.cdescrigrife ?? "").trim();
    if (!nome) { skipped++; continue; }
    const ativa = (row.cstatusgrife ?? "A") === "A";
    const found = byErp.get(erpId);
    if (found) {
      const patch: CollectionUpdate = { erp_synced_at: now };
      if (found.name !== nome) patch.name = nome;
      if (!ativa && (found.status === "briefing" || found.status === "desenvolvimento")) {
        patch.status = "descontinuada";
      }
      const { error } = await supabase.from("collections").update(patch).eq("id", found.id as string);
      if (!error) updated++; else skipped++;
    } else {
      const newStatus: CollectionStatus = ativa ? "briefing" : "descontinuada";
      const { error } = await supabase.from("collections").insert({
        owner_id: userId, name: nome, season: "ERP", year: new Date().getFullYear(),
        status: newStatus, erp_source: ERP_SOURCE, erp_id: erpId, erp_synced_at: now,
      });
      if (!error) inserted++; else skipped++;
    }
  }
  const summary = { total_erp: erpRows.length, inserted, updated, skipped, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "collections", "solgrife", inserted + updated, summary);
  return summary;
}

// ------------------------------------------------------------------ PRODUCTS
export async function runSyncProducts(supabase: SB, userId: string) {
  const startedAt = new Date().toISOString();
  type ErpRow = {
    nnumeroprodu: number | string; ccodigoprodu: string | null; ceanprodu: string | null;
    cnomeprodu: string; cstatusprodu: string | null; ncustoprodu: number | string | null;
    nprcvenprodu: number | string | null; nnumerogrife: number | string | null; cdsccplprodu: string | null;
  };
  let erpRows: ErpRow[] = [];
  try {
    const r = await usesoftQuery<ErpRow>(
      `SELECT nnumeroprodu, ccodigoprodu, ceanprodu, cnomeprodu, cstatusprodu, ncustoprodu, nprcvenprodu, nnumerogrife, cdsccplprodu
         FROM solprodu WHERE cstatusprodu = 'A' ORDER BY cnomeprodu`,
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "products", "solprodu", msg);
    throw new Error(msg);
  }
  const { data: erpCols } = await supabase.from("collections").select("id, erp_id")
    .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
  const colByErp = new Map((erpCols ?? []).filter((c) => c.erp_id).map((c) => [String(c.erp_id), c.id as string]));
  const { data: existing } = await supabase.from("products")
    .select("id, erp_id, name, status, cost_price, sell_price, collection_id")
    .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
  const byErp = new Map((existing ?? []).map((p) => [String(p.erp_id), p]));
  let inserted = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();
  const counts = await mapPool(erpRows, 25, async (row) => {
    const erpId = String(row.nnumeroprodu);
    const nome = String(row.cnomeprodu ?? "").trim();
    if (!nome) return "skipped" as const;
    const sku = (row.ccodigoprodu ? String(row.ccodigoprodu).trim() : "") || `ERP-${erpId}`;
    const custo = row.ncustoprodu == null ? 0 : Number(row.ncustoprodu) || 0;
    const preco = row.nprcvenprodu == null ? 0 : Number(row.nprcvenprodu) || 0;
    const collectionId = row.nnumerogrife ? colByErp.get(String(row.nnumerogrife)) ?? null : null;
    const found = byErp.get(erpId);
    if (found) {
      const patch: ProductUpdate = { erp_synced_at: now };
      if (found.name !== nome) patch.name = nome;
      if ((found.cost_price ?? 0) !== custo) patch.cost_price = custo;
      if ((found.sell_price ?? 0) !== preco) patch.sell_price = preco;
      if (collectionId && found.collection_id !== collectionId) patch.collection_id = collectionId;
      const { error } = await supabase.from("products").update(patch).eq("id", found.id as string);
      return error ? ("skipped" as const) : ("updated" as const);
    }
    const newStatus: ProductStatus = "producao";
    const { error } = await supabase.from("products").insert({
      owner_id: userId, name: nome, sku, status: newStatus, cost_price: custo, sell_price: preco,
      collection_id: collectionId, description: row.cdsccplprodu ? String(row.cdsccplprodu) : null,
      erp_source: ERP_SOURCE, erp_id: erpId, erp_synced_at: now,
    });
    return error ? ("skipped" as const) : ("inserted" as const);
  });
  for (const c of counts) {
    if (c === "inserted") inserted++;
    else if (c === "updated") updated++;
    else skipped++;
  }
  const summary = { total_erp: erpRows.length, inserted, updated, skipped, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "products", "solprodu", inserted + updated, summary);
  return summary;
}

// ----------------------------------------------------------------- CUSTOMERS
export async function runSyncCustomers(supabase: SB, userId: string) {
  const startedAt = new Date().toISOString();
  type ErpRow = {
    nnumeroclien: number | string; cnomeclien: string; cnfantaclien: string | null;
    ctipopeclien: string | null; ccnpjclien: string | null; ccpfclien: string | null;
    cemailnfecli: string | null; cendwebclien: string | null; cfoneclien: string | null;
  };
  let erpRows: ErpRow[] = [];
  try {
    const r = await usesoftQuery<ErpRow>(
      `SELECT nnumeroclien, cnomeclien, cnfantaclien, ctipopeclien, ccnpjclien, ccpfclien, cemailnfecli, cendwebclien, cfoneclien
         FROM solclien WHERE cstatusclien = 'A' ORDER BY cnomeclien`,
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "customers", "solclien", msg);
    throw new Error(msg);
  }
  const { data: existing } = await supabase.from("customers")
    .select("id, erp_id, name, email, phone, document")
    .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
  const byErp = new Map((existing ?? []).map((c) => [String(c.erp_id), c]));
  let inserted = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();
  const counts = await mapPool(erpRows, 25, async (row) => {
    const erpId = String(row.nnumeroclien);
    const nome = String(row.cnomeclien ?? "").trim();
    if (!nome) return "skipped" as const;
    const doc = (row.ctipopeclien === "J" ? row.ccnpjclien : row.ccpfclien) || null;
    const email = row.cemailnfecli || row.cendwebclien || null;
    const phone = row.cfoneclien || null;
    const found = byErp.get(erpId);
    if (found) {
      const patch: CustomerUpdate = { erp_synced_at: now };
      if (found.name !== nome) patch.name = nome;
      if ((found.document ?? null) !== doc) patch.document = doc;
      if ((found.email ?? null) !== email) patch.email = email;
      if ((found.phone ?? null) !== phone) patch.phone = phone;
      const { error } = await supabase.from("customers").update(patch).eq("id", found.id as string);
      return error ? ("skipped" as const) : ("updated" as const);
    }
    const { error } = await supabase.from("customers").insert({
      owner_id: userId, name: nome, document: doc, email, phone,
      erp_source: ERP_SOURCE, erp_id: erpId, erp_synced_at: now,
    });
    return error ? ("skipped" as const) : ("inserted" as const);
  });
  for (const c of counts) { if (c === "inserted") inserted++; else if (c === "updated") updated++; else skipped++; }
  const summary = { total_erp: erpRows.length, inserted, updated, skipped, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "customers", "solclien", inserted + updated, summary);
  return summary;
}

// ----------------------------------------------------------------- SUPPLIERS
export async function runSyncSuppliers(supabase: SB, userId: string) {
  const startedAt = new Date().toISOString();
  type ErpRow = {
    nnumeroforne: number | string; cnomeforne: string; cnfantaforne: string | null;
    ctipopeforne: string | null; ccnpjforne: string | null; ccpfforne: string | null;
    cemailforne: string | null; cfoneforne: string | null;
  };
  let erpRows: ErpRow[] = [];
  try {
    const r = await usesoftQuery<ErpRow>(
      `SELECT nnumeroforne, cnomeforne, cnfantaforne, ctipopeforne, ccnpjforne, ccpfforne, cemailforne, cfoneforne
         FROM solforne WHERE cstatusforne = 'A' ORDER BY cnomeforne`,
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "suppliers", "solforne", msg);
    throw new Error(msg);
  }
  const { data: existing } = await supabase.from("suppliers")
    .select("id, erp_id, name, email, phone, document")
    .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
  const byErp = new Map((existing ?? []).map((s) => [String(s.erp_id), s]));
  let inserted = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const row of erpRows) {
    const erpId = String(row.nnumeroforne);
    const nome = String(row.cnomeforne ?? "").trim();
    if (!nome) { skipped++; continue; }
    const doc = (row.ctipopeforne === "J" ? row.ccnpjforne : row.ccpfforne) || null;
    const email = row.cemailforne || null;
    const phone = row.cfoneforne || null;
    const found = byErp.get(erpId);
    if (found) {
      const patch: SupplierUpdate = { erp_synced_at: now };
      if (found.name !== nome) patch.name = nome;
      if ((found.document ?? null) !== doc) patch.document = doc;
      if ((found.email ?? null) !== email) patch.email = email;
      if ((found.phone ?? null) !== phone) patch.phone = phone;
      const { error } = await supabase.from("suppliers").update(patch).eq("id", found.id as string);
      if (!error) updated++; else skipped++;
    } else {
      const { error } = await supabase.from("suppliers").insert({
        owner_id: userId, name: nome, document: doc, email, phone, active: true,
        erp_source: ERP_SOURCE, erp_id: erpId, erp_synced_at: now,
      });
      if (!error) inserted++; else skipped++;
    }
  }
  const summary = { total_erp: erpRows.length, inserted, updated, skipped, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "suppliers", "solforne", inserted + updated, summary);
  return summary;
}

// ----------------------------------------------------------------- INVENTORY
export async function runSyncInventory(supabase: SB, userId: string) {
  const startedAt = new Date().toISOString();
  type ErpRow = {
    ccodigoprodu: string | null; nnumeroprodu: number | string;
    saldo_total: number | string; ncustoprodu: number | string | null; nprcvenprodu: number | string | null;
  };
  let erpRows: ErpRow[] = [];
  try {
    const r = await usesoftQuery<ErpRow>(
      `WITH saldo AS (SELECT nnumeroprodu, SUM(nsaldosaldo) AS total FROM estsaldo GROUP BY nnumeroprodu)
       SELECT p.ccodigoprodu, p.nnumeroprodu, COALESCE(saldo.total, 0) AS saldo_total, p.ncustoprodu, p.nprcvenprodu
         FROM solprodu p LEFT JOIN saldo ON saldo.nnumeroprodu = p.nnumeroprodu
        WHERE p.cstatusprodu = 'A'`,
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "inventory", "estsaldo", msg);
    throw new Error(msg);
  }
  await supabase.from("erp_inventory_mirror").delete().eq("owner_id", userId);
  const now = new Date().toISOString();
  const batch = erpRows.filter((r) => r.ccodigoprodu || r.nnumeroprodu).map((r) => ({
    owner_id: userId,
    sku: String(r.ccodigoprodu || `ERP-${r.nnumeroprodu}`),
    balance: Number(r.saldo_total) || 0,
    location: null as string | null,
    erp_updated_at: now,
    synced_at: now,
    raw: { erp_id: String(r.nnumeroprodu), cost: r.ncustoprodu == null ? null : Number(r.ncustoprodu), price: r.nprcvenprodu == null ? null : Number(r.nprcvenprodu) },
  }));
  let inserted = 0;
  for (let i = 0; i < batch.length; i += 500) {
    const slice = batch.slice(i, i + 500);
    const { error } = await supabase.from("erp_inventory_mirror").insert(slice);
    if (!error) inserted += slice.length;
  }
  const summary = { total_erp: erpRows.length, inserted, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "inventory", "estsaldo", inserted, summary);
  return summary;
}

// --------------------------------------------------------------------- SALES
export async function runSyncSales(supabase: SB, userId: string, daysBack = 90) {
  const startedAt = new Date().toISOString();
  type ErpRow = {
    nnumeropedid: number | string; ddatapedid: string | null; cliente_nome: string | null;
    nnumeroprodu: number | string | null; ccodigoprodu: string | null; cnomeprodu: string | null;
    nquatdeitped: number | string | null; nvltotitped: number | string | null;
  };
  let erpRows: ErpRow[] = [];
  try {
    const r = await usesoftQuery<ErpRow>(
      `SELECT p.nnumeropedid, p.ddatapedid,
              COALESCE(NULLIF(TRIM(p.cnomecliente),''), c.cnomeclien) AS cliente_nome,
              i.nnumeroprodu, pr.ccodigoprodu, pr.cnomeprodu,
              i.nquatdeitped, (COALESCE(i.nprecoitped,0) * COALESCE(i.nquatdeitped,0)) AS nvltotitped
         FROM solpedid p JOIN solitped i ON i.nnumeropedid = p.nnumeropedid
         LEFT JOIN solclien c ON c.nnumeroclien = p.nnumeroclien
         LEFT JOIN solprodu pr ON pr.nnumeroprodu = i.nnumeroprodu
        WHERE p.ddatapedid >= (CURRENT_DATE - ($1::int || ' days')::interval)
          AND COALESCE(p.cstatuspedid,'') <> 'C'`,
      [daysBack],
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "sales", "solpedid", msg);
    throw new Error(msg);
  }
  await supabase.from("erp_sales_mirror").delete().eq("owner_id", userId);
  const now = new Date().toISOString();
  const batch = erpRows.map((r, idx) => ({
    owner_id: userId,
    erp_sale_id: `${r.nnumeropedid}-${idx}`,
    sku: r.ccodigoprodu || (r.nnumeroprodu ? `ERP-${r.nnumeroprodu}` : null),
    product_ref: r.cnomeprodu || null,
    quantity: Number(r.nquatdeitped) || 0,
    total_value: Number(r.nvltotitped) || 0,
    customer: r.cliente_nome || null,
    region: null as string | null,
    channel: "erp",
    sold_at: r.ddatapedid ? new Date(r.ddatapedid).toISOString() : null,
    synced_at: now,
    raw: { pedido: String(r.nnumeropedid) },
  }));
  let inserted = 0;
  for (let i = 0; i < batch.length; i += 500) {
    const slice = batch.slice(i, i + 500);
    const { error } = await supabase.from("erp_sales_mirror").insert(slice);
    if (!error) inserted += slice.length;
  }
  const summary = { total_erp: erpRows.length, inserted, days_back: daysBack, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "sales", "solpedid", inserted, summary);
  return summary;
}

// ----------------------------------------------------------------- PURCHASES
export async function runSyncPurchases(supabase: SB, userId: string, daysBack = 180) {
  const startedAt = new Date().toISOString();
  type ErpRow = {
    nnumeropedcom: number | string; ddatapedcom: string | null; cnomeforne: string | null;
    nvltotpedcom: number | string | null; cstatuspedcom: string | null;
  };
  let erpRows: ErpRow[] = [];
  try {
    const r = await usesoftQuery<ErpRow>(
      `SELECT p.nnumeropedcom, p.ddatapedcom, f.cnomeforne, p.nvltotpedcom, p.cstatuspedcom
         FROM solpedcom p LEFT JOIN solforne f ON f.nnumeroforne = p.nnumeroforne
        WHERE p.ddatapedcom >= (CURRENT_DATE - ($1::int || ' days')::interval)`,
      [daysBack],
    );
    erpRows = r.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
    await logErr(supabase, userId, "purchases", "solpedcom", msg);
    throw new Error(msg);
  }
  await supabase.from("erp_purchase_mirror").delete().eq("owner_id", userId);
  const now = new Date().toISOString();
  const batch = erpRows.map((r) => ({
    owner_id: userId,
    erp_po_code: String(r.nnumeropedcom),
    supplier: r.cnomeforne || null,
    total_value: Number(r.nvltotpedcom) || 0,
    status: r.cstatuspedcom || null,
    ordered_at: r.ddatapedcom ? new Date(r.ddatapedcom).toISOString() : null,
    synced_at: now,
    raw: {},
  }));
  let inserted = 0;
  for (let i = 0; i < batch.length; i += 500) {
    const slice = batch.slice(i, i + 500);
    const { error } = await supabase.from("erp_purchase_mirror").insert(slice);
    if (!error) inserted += slice.length;
  }
  const summary = { total_erp: erpRows.length, inserted, days_back: daysBack, started_at: startedAt, finished_at: new Date().toISOString() };
  await logOk(supabase, userId, "purchases", "solpedcom", inserted, summary);
  return summary;
}
