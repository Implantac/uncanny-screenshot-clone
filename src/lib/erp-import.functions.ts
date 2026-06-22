/**
 * Sync ERP → PLM (read-only do lado do ERP).
 * Lê via `usesoftQuery` e faz upsert em tabelas do PLM por (owner_id, erp_source, erp_id).
 * Não sobrescreve campos próprios do PLM (palette, cover_url, description, etc).
 */
import type { Database } from "@/integrations/supabase/types";
type CollectionUpdate = Database["public"]["Tables"]["collections"]["Update"];
type CollectionStatus = Database["public"]["Enums"]["collection_status"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductStatus = Database["public"]["Enums"]["product_status"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";



const ERP_SOURCE = "usesoft";

export const syncErpCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();

    const { usesoftQuery } = await import(
      "@/integrations/usesoft/client.server"
    );

    // 1) LEITURA do ERP (read-only)
    let erpRows: Array<{
      nnumerogrife: number | string;
      cdescrigrife: string;
      cstatusgrife: string | null;
    }> = [];
    try {
      const r = await usesoftQuery<{
        nnumerogrife: number | string;
        cdescrigrife: string;
        cstatusgrife: string | null;
      }>(
        `SELECT nnumerogrife, cdescrigrife, cstatusgrife
           FROM solgrife
          ORDER BY cdescrigrife`,
      );
      erpRows = r.rows;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId,
        direction: "in",
        event_type: "sync",
        entity_type: "collections",
        entity_ref: "solgrife",
        status: "error",
        records_affected: 0,
        error_message: msg,
      });
      throw new Error(msg);
    }

    // 2) Carrega coleções já vinculadas ao ERP para esse owner
    const { data: existing } = await supabase
      .from("collections")
      .select("id, erp_id, name, status")
      .eq("owner_id", userId)
      .eq("erp_source", ERP_SOURCE);

    const existingByErpId = new Map<string, { id: string; name: string; status: string }>(
      (existing ?? []).map((c) => [
        String(c.erp_id),
        { id: c.id as string, name: c.name as string, status: c.status as string },
      ]),
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    // 3) Upsert por linha (volume baixo; grifes raramente passam de centenas)
    for (const row of erpRows) {
      const erpId = String(row.nnumerogrife);
      const nome = String(row.cdescrigrife ?? "").trim();
      if (!nome) {
        skipped++;
        continue;
      }
      const ativa = (row.cstatusgrife ?? "A") === "A";

      const found = existingByErpId.get(erpId);
      if (found) {
        // Só atualiza name (cadastro do ERP) e timestamp; preserva campos PLM.
        const patch: CollectionUpdate = { erp_synced_at: now };
        if (found.name !== nome) patch.name = nome;
        // Se o ERP desativou e o PLM ainda está em briefing/desenvolvimento,
        // marcamos como descontinuada. Nunca rebaixa um lançamento ativo.
        if (
          !ativa &&
          (found.status === "briefing" || found.status === "desenvolvimento")
        ) {
          patch.status = "descontinuada";
        }
        const { error } = await supabase
          .from("collections")
          .update(patch)
          .eq("id", found.id);
        if (!error) updated++;
        else skipped++;
      } else {
        // Nova coleção espelhada do ERP — começa em "briefing" para o PLM trabalhar.
        const newStatus: CollectionStatus = ativa ? "briefing" : "descontinuada";
        const { error } = await supabase.from("collections").insert({
          owner_id: userId,
          name: nome,
          season: "ERP",
          year: new Date().getFullYear(),
          status: newStatus,
          erp_source: ERP_SOURCE,
          erp_id: erpId,
          erp_synced_at: now,
        });
        if (!error) inserted++;
        else skipped++;
      }
    }

    const summary = {
      total_erp: erpRows.length,
      inserted,
      updated,
      skipped,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };

    await supabase.from("erp_sync_log").insert({
      owner_id: userId,
      direction: "in",
      event_type: "sync",
      entity_type: "collections",
      entity_ref: "solgrife",
      status: "success",
      records_affected: inserted + updated,
      payload: summary,
    });

    return summary;
  });

export const getErpCollectionSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: linkedCount }, { data: lastLog }] = await Promise.all([
      supabase
        .from("collections")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("erp_source", ERP_SOURCE),
      supabase
        .from("erp_sync_log")
        .select("created_at, status, records_affected, payload, error_message")
        .eq("owner_id", userId)
        .eq("entity_type", "collections")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      linked: linkedCount ?? 0,
      lastSync: lastLog ?? null,
    };
  });

// ============================================================================
// PRODUTOS — solprodu → public.products
// ============================================================================

export const syncErpProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();

    const { usesoftQuery } = await import(
      "@/integrations/usesoft/client.server"
    );

    // 1) LEITURA do ERP (somente produtos ativos, com vínculo opcional à grife)
    type ErpRow = {
      nnumeroprodu: number | string;
      ccodigoprodu: string | null;
      ceanprodu: string | null;
      cnomeprodu: string;
      cstatusprodu: string | null;
      ncustoprodu: number | string | null;
      nprcvenprodu: number | string | null;
      nnumerogrife: number | string | null;
      cdsccplprodu: string | null;
    };
    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `SELECT nnumeroprodu, ccodigoprodu, ceanprodu, cnomeprodu,
                cstatusprodu, ncustoprodu, nprcvenprodu,
                nnumerogrife, cdsccplprodu
           FROM solprodu
          WHERE cstatusprodu = 'A'
          ORDER BY cnomeprodu`,
      );
      erpRows = r.rows;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId,
        direction: "in",
        event_type: "sync",
        entity_type: "products",
        entity_ref: "solprodu",
        status: "error",
        records_affected: 0,
        error_message: msg,
      });
      throw new Error(msg);
    }

    // 2) Mapa de grifes do ERP → collection.id do PLM (para auto-vinculo)
    const { data: erpCollections } = await supabase
      .from("collections")
      .select("id, erp_id")
      .eq("owner_id", userId)
      .eq("erp_source", ERP_SOURCE);
    const collectionByErpId = new Map<string, string>(
      (erpCollections ?? [])
        .filter((c) => c.erp_id)
        .map((c) => [String(c.erp_id), c.id as string]),
    );

    // 3) Produtos já vinculados ao ERP
    const { data: existing } = await supabase
      .from("products")
      .select("id, erp_id, name, status, cost_price, sell_price, collection_id")
      .eq("owner_id", userId)
      .eq("erp_source", ERP_SOURCE);
    const existingByErpId = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        cost_price: number | null;
        sell_price: number | null;
        collection_id: string | null;
      }
    >(
      (existing ?? []).map((p) => [
        String(p.erp_id),
        {
          id: p.id as string,
          name: p.name as string,
          status: p.status as string,
          cost_price: p.cost_price as number | null,
          sell_price: p.sell_price as number | null,
          collection_id: p.collection_id as string | null,
        },
      ]),
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const row of erpRows) {
      const erpId = String(row.nnumeroprodu);
      const nome = String(row.cnomeprodu ?? "").trim();
      if (!nome) {
        skipped++;
        continue;
      }
      const sku =
        (row.ccodigoprodu ? String(row.ccodigoprodu).trim() : "") ||
        `ERP-${erpId}`;
      const custo = row.ncustoprodu == null ? 0 : Number(row.ncustoprodu) || 0;
      const preco = row.nprcvenprodu == null ? 0 : Number(row.nprcvenprodu) || 0;
      const collectionId = row.nnumerogrife
        ? collectionByErpId.get(String(row.nnumerogrife)) ?? null
        : null;

      const found = existingByErpId.get(erpId);
      if (found) {
        // Atualiza só campos espelhados do ERP. Preserva ficha técnica,
        // imagens, sizes/colors, descrições e qualquer trabalho do PLM.
        const patch: ProductUpdate = { erp_synced_at: now };
        if (found.name !== nome) patch.name = nome;
        if ((found.cost_price ?? 0) !== custo) patch.cost_price = custo;
        if ((found.sell_price ?? 0) !== preco) patch.sell_price = preco;
        if (collectionId && found.collection_id !== collectionId) {
          patch.collection_id = collectionId;
        }
        const { error } = await supabase
          .from("products")
          .update(patch)
          .eq("id", found.id);
        if (!error) updated++;
        else skipped++;
      } else {
        const newStatus: ProductStatus = "producao";
        const { error } = await supabase.from("products").insert({
          owner_id: userId,
          name: nome,
          sku,
          status: newStatus,
          cost_price: custo,
          sell_price: preco,
          collection_id: collectionId,
          description: row.cdsccplprodu ? String(row.cdsccplprodu) : null,
          erp_source: ERP_SOURCE,
          erp_id: erpId,
          erp_synced_at: now,
        });
        if (!error) inserted++;
        else skipped++;
      }
    }

    const summary = {
      total_erp: erpRows.length,
      inserted,
      updated,
      skipped,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };

    await supabase.from("erp_sync_log").insert({
      owner_id: userId,
      direction: "in",
      event_type: "sync",
      entity_type: "products",
      entity_ref: "solprodu",
      status: "success",
      records_affected: inserted + updated,
      payload: summary,
    });

    return summary;
  });

export const getErpProductSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: linkedCount }, { data: lastLog }] = await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("erp_source", ERP_SOURCE),
      supabase
        .from("erp_sync_log")
        .select("created_at, status, records_affected, payload, error_message")
        .eq("owner_id", userId)
        .eq("entity_type", "products")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      linked: linkedCount ?? 0,
      lastSync: lastLog ?? null,
    };
  });

// ============================================================================
// CLIENTES — solclien → public.customers
// ============================================================================

export const syncErpCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

    type ErpRow = {
      nnumeroclien: number | string;
      cnomeclien: string;
      cnfantaclien: string | null;
      ctipopeclien: string | null;
      ccnpjclien: string | null;
      ccpfclien: string | null;
      cemailnfecli: string | null;
      cendwebclien: string | null;
      cfoneclien: string | null;
    };

    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `SELECT nnumeroclien, cnomeclien, cnfantaclien, ctipopeclien,
                ccnpjclien, ccpfclien, cemailnfecli, cendwebclien, cfoneclien
           FROM solclien
          WHERE cstatusclien = 'A'
          ORDER BY cnomeclien`,
      );
      erpRows = r.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId, direction: "in", event_type: "sync",
        entity_type: "customers", entity_ref: "solclien",
        status: "error", records_affected: 0, error_message: msg,
      });
      throw new Error(msg);
    }

    const { data: existing } = await supabase
      .from("customers").select("id, erp_id, name, email, phone, document")
      .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
    const existingByErpId = new Map(
      (existing ?? []).map((c) => [String(c.erp_id), c]),
    );

    let inserted = 0, updated = 0, skipped = 0;
    const now = new Date().toISOString();

    for (const row of erpRows) {
      const erpId = String(row.nnumeroclien);
      const nome = String(row.cnomeclien ?? "").trim();
      if (!nome) { skipped++; continue; }
      const doc = (row.ctipopeclien === "J" ? row.ccnpjclien : row.ccpfclien) || null;
      const email = row.cemailnfecli || row.cendwebclien || null;
      const phone = row.cfoneclien || null;

      const found = existingByErpId.get(erpId);
      if (found) {
        const patch: CustomerUpdate = { erp_synced_at: now };
        if (found.name !== nome) patch.name = nome;
        if ((found.document ?? null) !== doc) patch.document = doc;
        if ((found.email ?? null) !== email) patch.email = email;
        if ((found.phone ?? null) !== phone) patch.phone = phone;
        const { error } = await supabase.from("customers").update(patch).eq("id", found.id as string);
        if (!error) updated++; else skipped++;
      } else {
        const { error } = await supabase.from("customers").insert({
          owner_id: userId, name: nome, document: doc, email, phone,
          erp_source: ERP_SOURCE, erp_id: erpId, erp_synced_at: now,
        });
        if (!error) inserted++; else skipped++;
      }
    }

    const summary = { total_erp: erpRows.length, inserted, updated, skipped,
      started_at: startedAt, finished_at: new Date().toISOString() };
    await supabase.from("erp_sync_log").insert({
      owner_id: userId, direction: "in", event_type: "sync",
      entity_type: "customers", entity_ref: "solclien",
      status: "success", records_affected: inserted + updated, payload: summary,
    });
    return summary;
  });

// ============================================================================
// FORNECEDORES — solforne → public.suppliers
// ============================================================================

export const syncErpSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

    type ErpRow = {
      nnumeroforne: number | string;
      cnomeforne: string;
      cnfantaforne: string | null;
      ctipopeforne: string | null;
      ccnpjforne: string | null;
      ccpfforne: string | null;
      cemailforne: string | null;
      cfoneforne: string | null;
    };

    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `SELECT nnumeroforne, cnomeforne, cnfantaforne, ctipopeforne,
                ccnpjforne, ccpfforne, cemailforne, cfoneforne
           FROM solforne
          WHERE cstatusforne = 'A'
          ORDER BY cnomeforne`,
      );
      erpRows = r.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId, direction: "in", event_type: "sync",
        entity_type: "suppliers", entity_ref: "solforne",
        status: "error", records_affected: 0, error_message: msg,
      });
      throw new Error(msg);
    }

    const { data: existing } = await supabase
      .from("suppliers").select("id, erp_id, name, email, phone, document")
      .eq("owner_id", userId).eq("erp_source", ERP_SOURCE);
    const existingByErpId = new Map(
      (existing ?? []).map((s) => [String(s.erp_id), s]),
    );

    let inserted = 0, updated = 0, skipped = 0;
    const now = new Date().toISOString();

    for (const row of erpRows) {
      const erpId = String(row.nnumeroforne);
      const nome = String(row.cnomeforne ?? "").trim();
      if (!nome) { skipped++; continue; }
      const doc = (row.ctipopeforne === "J" ? row.ccnpjforne : row.ccpfforne) || null;
      const email = row.cemailforne || null;
      const phone = row.cfoneforne || null;

      const found = existingByErpId.get(erpId);
      if (found) {
        const patch: Record<string, unknown> = { erp_synced_at: now };
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

    const summary = { total_erp: erpRows.length, inserted, updated, skipped,
      started_at: startedAt, finished_at: new Date().toISOString() };
    await supabase.from("erp_sync_log").insert({
      owner_id: userId, direction: "in", event_type: "sync",
      entity_type: "suppliers", entity_ref: "solforne",
      status: "success", records_affected: inserted + updated, payload: summary,
    });
    return summary;
  });

// ============================================================================
// ESTOQUE — estsaldo → public.erp_inventory_mirror (espelho cru)
// ============================================================================

export const syncErpInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

    type ErpRow = {
      ccodigoprodu: string | null;
      nnumeroprodu: number | string;
      saldo_total: number | string;
      ncustoprodu: number | string | null;
      nprcvenprodu: number | string | null;
    };

    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `WITH saldo AS (
           SELECT nnumeroprodu, SUM(nsaldosaldo) AS total
             FROM estsaldo GROUP BY nnumeroprodu
         )
         SELECT p.ccodigoprodu, p.nnumeroprodu,
                COALESCE(saldo.total, 0) AS saldo_total,
                p.ncustoprodu, p.nprcvenprodu
           FROM solprodu p
           LEFT JOIN saldo ON saldo.nnumeroprodu = p.nnumeroprodu
          WHERE p.cstatusprodu = 'A'`,
      );
      erpRows = r.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId, direction: "in", event_type: "sync",
        entity_type: "inventory", entity_ref: "estsaldo",
        status: "error", records_affected: 0, error_message: msg,
      });
      throw new Error(msg);
    }

    // Wipe + reinsert (espelho — sempre snapshot atual)
    await supabase.from("erp_inventory_mirror").delete().eq("owner_id", userId);

    const now = new Date().toISOString();
    const batch = erpRows
      .filter((r) => r.ccodigoprodu || r.nnumeroprodu)
      .map((r) => ({
        owner_id: userId,
        sku: String(r.ccodigoprodu || `ERP-${r.nnumeroprodu}`),
        balance: Number(r.saldo_total) || 0,
        location: null as string | null,
        erp_updated_at: now,
        synced_at: now,
        raw: {
          erp_id: String(r.nnumeroprodu),
          cost: r.ncustoprodu == null ? null : Number(r.ncustoprodu),
          price: r.nprcvenprodu == null ? null : Number(r.nprcvenprodu),
        },
      }));

    // chunks de 500
    let inserted = 0;
    for (let i = 0; i < batch.length; i += 500) {
      const slice = batch.slice(i, i + 500);
      const { error } = await supabase.from("erp_inventory_mirror").insert(slice);
      if (!error) inserted += slice.length;
    }

    const summary = { total_erp: erpRows.length, inserted, started_at: startedAt,
      finished_at: new Date().toISOString() };
    await supabase.from("erp_sync_log").insert({
      owner_id: userId, direction: "in", event_type: "sync",
      entity_type: "inventory", entity_ref: "estsaldo",
      status: "success", records_affected: inserted, payload: summary,
    });
    return summary;
  });

// ============================================================================
// VENDAS — solpedid + solitped → public.erp_sales_mirror (90 dias)
// ============================================================================

export const syncErpSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const d = (i ?? {}) as { daysBack?: number };
    return { daysBack: Math.min(Math.max(Number(d.daysBack ?? 90), 1), 365) };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

    type ErpRow = {
      nnumeropedid: number | string;
      ddatapedid: string | null;
      cliente_nome: string | null;
      nnumeroprodu: number | string | null;
      ccodigoprodu: string | null;
      cnomeprodu: string | null;
      nquantitped: number | string | null;
      nvltotitped: number | string | null;
    };

    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `SELECT p.nnumeropedid, p.ddatapedid,
                COALESCE(NULLIF(TRIM(p.cnomecliente),''), c.cnomeclien) AS cliente_nome,
                i.nnumeroprodu, pr.ccodigoprodu, pr.cnomeprodu,
                i.nquantitped, i.nvltotitped
           FROM solpedid p
           JOIN solitped i ON i.nnumeropedid = p.nnumeropedid
           LEFT JOIN solclien c  ON c.nnumeroclien = p.nnumeroclien
           LEFT JOIN solprodu pr ON pr.nnumeroprodu = i.nnumeroprodu
          WHERE p.ddatapedid >= (CURRENT_DATE - ($1::int || ' days')::interval)
            AND COALESCE(p.cstatuspedid,'') <> 'C'`,
        [data.daysBack],
      );
      erpRows = r.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId, direction: "in", event_type: "sync",
        entity_type: "sales", entity_ref: "solpedid",
        status: "error", records_affected: 0, error_message: msg,
      });
      throw new Error(msg);
    }

    // Substitui janela inteira (snapshot dos últimos N dias)
    await supabase.from("erp_sales_mirror").delete().eq("owner_id", userId);

    const now = new Date().toISOString();
    const batch = erpRows.map((r, idx) => ({
      owner_id: userId,
      erp_sale_id: `${r.nnumeropedid}-${idx}`,
      sku: r.ccodigoprodu || (r.nnumeroprodu ? `ERP-${r.nnumeroprodu}` : null),
      product_ref: r.cnomeprodu || null,
      quantity: Number(r.nquantitped) || 0,
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

    const summary = { total_erp: erpRows.length, inserted, days_back: data.daysBack,
      started_at: startedAt, finished_at: new Date().toISOString() };
    await supabase.from("erp_sync_log").insert({
      owner_id: userId, direction: "in", event_type: "sync",
      entity_type: "sales", entity_ref: "solpedid",
      status: "success", records_affected: inserted, payload: summary,
    });
    return summary;
  });

// ============================================================================
// COMPRAS — solpedcom → public.erp_purchase_mirror (180 dias)
// ============================================================================

export const syncErpPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const d = (i ?? {}) as { daysBack?: number };
    return { daysBack: Math.min(Math.max(Number(d.daysBack ?? 180), 1), 730) };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const startedAt = new Date().toISOString();
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

    type ErpRow = {
      nnumeropedcom: number | string;
      ddatapedcom: string | null;
      cnomeforne: string | null;
      nvltotpedcom: number | string | null;
      cstatuspedcom: string | null;
    };

    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
        `SELECT p.nnumeropedcom, p.ddatapedcom, f.cnomeforne,
                p.nvltotpedcom, p.cstatuspedcom
           FROM solpedcom p
           LEFT JOIN solforne f ON f.nnumeroforne = p.nnumeroforne
          WHERE p.ddatapedcom >= (CURRENT_DATE - ($1::int || ' days')::interval)`,
        [data.daysBack],
      );
      erpRows = r.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ler ERP";
      await supabase.from("erp_sync_log").insert({
        owner_id: userId, direction: "in", event_type: "sync",
        entity_type: "purchases", entity_ref: "solpedcom",
        status: "error", records_affected: 0, error_message: msg,
      });
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

    const summary = { total_erp: erpRows.length, inserted, days_back: data.daysBack,
      started_at: startedAt, finished_at: new Date().toISOString() };
    await supabase.from("erp_sync_log").insert({
      owner_id: userId, direction: "in", event_type: "sync",
      entity_type: "purchases", entity_ref: "solpedcom",
      status: "success", records_affected: inserted, payload: summary,
    });
    return summary;
  });

// ============================================================================
// STATUS GENÉRICO + SYNC TUDO
// ============================================================================

async function statusFor(
  supabase: { from: (t: string) => unknown },
  userId: string,
  table: string,
  entity: string,
) {
  type Q = { select: (s: string, o?: unknown) => Q; eq: (a: string, b: string) => Q;
    order?: (a: string, b: unknown) => Q; limit?: (n: number) => Q; maybeSingle?: () => Promise<unknown>;
    then?: unknown; };
  const sb = supabase as { from: (t: string) => Q };
  const tableHasErpLink = table === "customers" || table === "suppliers";
  const linkedQ = tableHasErpLink
    ? (sb.from(table).select("id", { count: "exact", head: true }) as unknown as Q)
        .eq("owner_id", userId).eq("erp_source", ERP_SOURCE)
    : (sb.from(table).select("id", { count: "exact", head: true }) as unknown as Q)
        .eq("owner_id", userId);
  const [linkedRes, logRes] = await Promise.all([
    linkedQ as unknown as Promise<{ count: number | null }>,
    (sb.from("erp_sync_log").select("created_at, status, records_affected, payload, error_message") as unknown as Q)
      .eq("owner_id", userId).eq("entity_type", entity)
      .order!("created_at", { ascending: false }).limit!(1).maybeSingle!() as Promise<{ data: unknown }>,
  ]);
  return {
    linked: linkedRes.count ?? 0,
    lastSync: (logRes as { data: unknown }).data ?? null,
  };
}

export const getErpCustomerSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    statusFor(context.supabase as never, context.userId, "customers", "customers"));

export const getErpSupplierSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    statusFor(context.supabase as never, context.userId, "suppliers", "suppliers"));

export const getErpInventorySyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    statusFor(context.supabase as never, context.userId, "erp_inventory_mirror", "inventory"));

export const getErpSalesSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    statusFor(context.supabase as never, context.userId, "erp_sales_mirror", "sales"));

export const getErpPurchaseSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    statusFor(context.supabase as never, context.userId, "erp_purchase_mirror", "purchases"));

