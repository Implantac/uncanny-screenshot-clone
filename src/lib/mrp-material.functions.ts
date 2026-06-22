import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Z_TABLE: Record<number, number> = { 90: 1.28, 95: 1.65, 97: 1.88, 99: 2.33 };

/**
 * Persiste overrides MRP por material (nível de serviço + lead time).
 * Grava em inventory_items.mrp_overrides (JSONB) — já é consumido por runMrpPlanning.
 */
export const saveMaterialMrpOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { inventoryItemId: string; serviceLevel?: number | null; leadTimeDays?: number | null }) =>
      z
        .object({
          inventoryItemId: z.string().uuid(),
          serviceLevel: z
            .number()
            .refine((v) => [90, 95, 97, 99].includes(v))
            .nullable()
            .optional(),
          leadTimeDays: z.number().int().min(1).max(365).nullable().optional(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur, error: cErr } = await supabase
      .from("inventory_items")
      .select("mrp_overrides")
      .eq("owner_id", userId)
      .eq("id", data.inventoryItemId)
      .single();
    if (cErr) throw new Error(cErr.message);

    const overrides = { ...((cur.mrp_overrides ?? {}) as Record<string, number>) };

    if (data.serviceLevel === null) {
      delete overrides.service_level;
      delete overrides.z;
    } else if (typeof data.serviceLevel === "number") {
      overrides.service_level = data.serviceLevel;
      overrides.z = Z_TABLE[data.serviceLevel] ?? 1.65;
    }

    if (data.leadTimeDays === null) {
      delete overrides.lead_time_days;
    } else if (typeof data.leadTimeDays === "number") {
      overrides.lead_time_days = data.leadTimeDays;
    }

    const { error: uErr } = await supabase
      .from("inventory_items")
      .update({ mrp_overrides: overrides })
      .eq("owner_id", userId)
      .eq("id", data.inventoryItemId);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, overrides };
  });

export type MaterialDetail = {
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    balance: number;
    deposit: string | null;
    supplierId: string | null;
    supplierName: string | null;
    leadTimeDays: number | null;
  };
  consumption: {
    days30: number;
    days90: number;
    days180: number;
    days365: number;
    monthlyAvg: number;
    dailyAvg: number;
    stdDev: number;
    series: { date: string; qty: number }[]; // 30 dias
  };
  openPurchaseOrders: {
    id: string;
    code: string;
    supplier: string | null;
    quantity: number;
    expectedDate: string | null;
    status: string;
  }[];
  productionDemand: {
    opCode: string;
    productId: string | null;
    productName: string | null;
    opQuantity: number;
    matRequired: number;
    dueDate: string | null;
    status: string;
  }[];
  timeline: { at: string; kind: string; text: string }[];
};

export const getMaterialDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { inventoryItemId: string }) =>
    z.object({ inventoryItemId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<MaterialDetail> => {
    const { supabase, userId } = context;
    const itemId = data.inventoryItemId;

    const { data: it, error: iErr } = await supabase
      .from("inventory_items")
      .select(
        "id,sku,name,unit,balance,deposit,preferred_supplier_id",
      )
      .eq("owner_id", userId)
      .eq("id", itemId)
      .single();
    if (iErr) throw new Error(iErr.message);

    let supplierName: string | null = null;
    let leadTimeDays: number | null = null;
    if (it.preferred_supplier_id) {
      const { data: s } = await supabase
        .from("suppliers")
        .select("name,lead_time_days")
        .eq("id", it.preferred_supplier_id)
        .maybeSingle();
      supplierName = s?.name ?? null;
      leadTimeDays = s?.lead_time_days ?? null;
    }

    // saidas 365d
    const since = new Date(Date.now() - 365 * 86400000).toISOString();
    const { data: mvs } = await supabase
      .from("stock_movements")
      .select("type,quantity,created_at")
      .eq("owner_id", userId)
      .eq("inventory_item_id", itemId)
      .gte("created_at", since);

    const now = Date.now();
    let d30 = 0,
      d90 = 0,
      d180 = 0,
      d365 = 0;
    const monthly = new Map<string, number>();
    const daily = new Map<string, number>(); // últimos 30 dias
    for (const m of mvs ?? []) {
      if (m.type !== "saida") continue;
      const q = Number(m.quantity ?? 0);
      const t = new Date(m.created_at ?? "").getTime();
      const ageD = (now - t) / 86400000;
      if (ageD <= 30) d30 += q;
      if (ageD <= 90) d90 += q;
      if (ageD <= 180) d180 += q;
      d365 += q;
      const ym = (m.created_at ?? "").slice(0, 7);
      if (ym) monthly.set(ym, (monthly.get(ym) ?? 0) + q);
      if (ageD <= 30) {
        const day = (m.created_at ?? "").slice(0, 10);
        if (day) daily.set(day, (daily.get(day) ?? 0) + q);
      }
    }
    // série de 30 dias preenchida
    const series: { date: string; qty: number }[] = [];
    for (let k = 29; k >= 0; k--) {
      const dd = new Date(now - k * 86400000).toISOString().slice(0, 10);
      series.push({ date: dd, qty: daily.get(dd) ?? 0 });
    }
    const months: number[] = [];
    const today = new Date();
    for (let k = 11; k >= 0; k--) {
      const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(monthly.get(ym) ?? 0);
    }
    const mean = months.reduce((a, b) => a + b, 0) / months.length;
    const stdDev = Math.sqrt(
      months.reduce((a, b) => a + (b - mean) ** 2, 0) / months.length,
    );

    // POs em aberto
    const { data: poi } = await supabase
      .from("purchase_order_items")
      .select(
        "quantity,purchase_orders!inner(id,code,status,expected_date,supplier_id,owner_id)",
      )
      .eq("owner_id", userId)
      .eq("inventory_item_id", itemId);
    const supplierIds = Array.from(
      new Set(
        (poi ?? [])
          .map((p) => (p as { purchase_orders: { supplier_id: string | null } }).purchase_orders?.supplier_id)
          .filter((s): s is string => Boolean(s)),
      ),
    );
    const supMap = new Map<string, string>();
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id,name")
        .in("id", supplierIds);
      for (const s of sups ?? []) supMap.set(s.id, s.name);
    }
    const openPurchaseOrders = (poi ?? [])
      .map((p) => {
        const po = (p as unknown as {
          purchase_orders: {
            id: string;
            code: string;
            status: string;
            expected_date: string | null;
            supplier_id: string | null;
          };
        }).purchase_orders;
        return {
          id: po.id,
          code: po.code,
          status: po.status,
          expectedDate: po.expected_date,
          quantity: Number(p.quantity ?? 0),
          supplier: po.supplier_id ? (supMap.get(po.supplier_id) ?? null) : null,
        };
      })
      .filter((p) => p.status !== "recebido" && p.status !== "cancelado");

    // OPs que consomem este material (via tech_sheet_materials das fichas aprovadas)
    const { data: mats } = await supabase
      .from("tech_sheet_materials")
      .select("tech_sheet_id,consumption,loss_pct")
      .eq("owner_id", userId)
      .eq("inventory_item_id", itemId);
    const sheetIds = Array.from(new Set((mats ?? []).map((m) => m.tech_sheet_id)));
    const consumptionBySheet = new Map<string, number>();
    for (const m of mats ?? []) {
      const c = Number(m.consumption ?? 0) * (1 + Number(m.loss_pct ?? 0) / 100);
      consumptionBySheet.set(m.tech_sheet_id, (consumptionBySheet.get(m.tech_sheet_id) ?? 0) + c);
    }
    let productionDemand: MaterialDetail["productionDemand"] = [];
    if (sheetIds.length) {
      const { data: sheets } = await supabase
        .from("tech_sheets")
        .select("id,product_id,status")
        .in("id", sheetIds)
        .eq("status", "aprovada");
      const sheetByProduct = new Map<string, { sheetId: string; perPiece: number }>();
      for (const s of sheets ?? []) {
        if (!s.product_id) continue;
        const per = consumptionBySheet.get(s.id) ?? 0;
        if (!sheetByProduct.has(s.product_id)) sheetByProduct.set(s.product_id, { sheetId: s.id, perPiece: per });
      }
      const productIds = Array.from(sheetByProduct.keys());
      if (productIds.length) {
        const { data: ops } = await supabase
          .from("production_orders")
          .select("code,product_id,quantity,due_date,status")
          .eq("owner_id", userId)
          .in("product_id", productIds)
          .neq("status", "concluida")
          .gt("quantity", 0);
        const { data: prods } = await supabase
          .from("products")
          .select("id,name")
          .in("id", productIds);
        const prodById = new Map((prods ?? []).map((p) => [p.id, p.name]));
        productionDemand = (ops ?? []).map((o) => {
          const per = o.product_id ? sheetByProduct.get(o.product_id)?.perPiece ?? 0 : 0;
          return {
            opCode: o.code,
            productId: o.product_id,
            productName: o.product_id ? (prodById.get(o.product_id) ?? null) : null,
            opQuantity: Number(o.quantity ?? 0),
            matRequired: Number((per * Number(o.quantity ?? 0)).toFixed(2)),
            dueDate: o.due_date,
            status: o.status as string,
          };
        });
      }
    }

    // Timeline: últimos 20 movimentos
    const { data: lastMvs } = await supabase
      .from("stock_movements")
      .select("type,quantity,notes,created_at")
      .eq("owner_id", userId)
      .eq("inventory_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(20);
    const timeline = (lastMvs ?? []).map((m) => ({
      at: m.created_at ?? "",
      kind: m.type as string,
      text: `${m.type === "entrada" ? "+" : m.type === "saida" ? "−" : ""}${Number(m.quantity ?? 0)} ${it.unit ?? ""}${m.notes ? ` · ${m.notes}` : ""}`,
    }));

    return {
      item: {
        id: it.id,
        sku: it.sku,
        name: it.name,
        unit: it.unit ?? "un",
        balance: Number(it.balance ?? 0),
        deposit: it.deposit ?? null,
        supplierId: it.preferred_supplier_id ?? null,
        supplierName,
        leadTimeDays,
      },
      consumption: {
        days30: d30,
        days90: d90,
        days180: d180,
        days365: d365,
        monthlyAvg: Number(mean.toFixed(0)),
        dailyAvg: Number((d90 / 90).toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        series,
      },
      openPurchaseOrders,
      productionDemand,
      timeline,
    };
  });

/**
 * Cria solicitação de compra (PO + item) para um material.
 */
export const generatePurchaseSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { inventoryItemId: string; quantity: number; supplierId?: string }) =>
    z
      .object({
        inventoryItemId: z.string().uuid(),
        quantity: z.number().positive(),
        supplierId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: it, error } = await supabase
      .from("inventory_items")
      .select("id,sku,name,unit,preferred_supplier_id,avg_unit_cost")
      .eq("owner_id", userId)
      .eq("id", data.inventoryItemId)
      .single();
    if (error) throw new Error(error.message);

    const supplierId = data.supplierId ?? it.preferred_supplier_id;
    let leadTime = 14;
    if (supplierId) {
      const { data: s } = await supabase
        .from("suppliers")
        .select("lead_time_days")
        .eq("id", supplierId)
        .maybeSingle();
      leadTime = Number(s?.lead_time_days ?? 14);
    }
    const expected = new Date(Date.now() + leadTime * 86400000).toISOString().slice(0, 10);
    const code = "SC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" +
      it.sku.replace(/\s+/g, "").slice(0, 8).toUpperCase();
    const unitPrice = Number(it.avg_unit_cost ?? 0);
    const total = unitPrice * data.quantity;

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        owner_id: userId,
        supplier_id: supplierId,
        code,
        status: "rascunho",
        expected_date: expected,
        total_value: total,
        notes: `Gerada pelo MRP · sugestão para ${it.sku} ${it.name}`,
      })
      .select("id,code")
      .single();
    if (poErr) throw new Error(poErr.message);

    const { error: itErr } = await supabase.from("purchase_order_items").insert({
      owner_id: userId,
      purchase_order_id: po.id,
      inventory_item_id: it.id,
      description: `${it.sku} · ${it.name}`,
      quantity: data.quantity,
      unit_price: unitPrice,
      total,
    });
    if (itErr) throw new Error(itErr.message);

    return { id: po.id, code: po.code };
  });

/**
 * Sincroniza alertas MRP em marketing_notifications (idempotente por item/dia).
 * Cria alertas para itens críticos / cobertura baixa / excesso.
 */
export const syncMrpAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { computeMrpPlanning } = await import("./mrp-planning.functions");
    const planning = await computeMrpPlanning({ data: {} });
    const today = new Date().toISOString().slice(0, 10);

    let created = 0;
    for (const r of planning.rows) {
      let kind: string | null = null;
      let title = "";
      let body = "";
      if (r.status === "critico") {
        kind = "mrp_critico";
        title = `MRP · ${r.sku} crítico`;
        body = `Saldo ${r.balance} ≤ PP ${r.reorderPoint}. Sugestão ${r.suggestedPurchase} ${r.unit}.`;
      } else if (r.coverageDays !== null && r.coverageDays < 10 && r.dailyConsumption > 0) {
        kind = "mrp_cobertura";
        title = `MRP · ${r.sku} cobertura ${r.coverageDays}d`;
        body = `Restam ~${r.coverageDays} dias de cobertura. Sugestão ${r.suggestedPurchase} ${r.unit}.`;
      } else if (r.status === "excesso") {
        kind = "mrp_excesso";
        title = `MRP · ${r.sku} em excesso`;
        body = `Saldo ${r.balance} > Máx ${r.maximum}. Avalie remanejamento.`;
      }
      if (!kind) continue;

      const refKey = `${kind}:${r.id}:${today}`;
      const { data: existing } = await supabase
        .from("marketing_notifications")
        .select("id")
        .eq("owner_id", userId)
        .eq("kind", kind)
        .eq("ref_id", r.id)
        .gte("created_at", today + "T00:00:00.000Z")
        .maybeSingle();
      if (existing) continue;

      const { error: nErr } = await supabase.from("marketing_notifications").insert({
        owner_id: userId,
        kind,
        title,
        body: body + ` [${refKey}]`,
        link: "/mrp",
        ref_id: r.id,
      });
      if (!nErr) created++;
    }
    return { created, totalEvaluated: planning.rows.length };
  });
