import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Z-table para nível de serviço
const Z_TABLE: Record<number, number> = { 90: 1.28, 95: 1.65, 97: 1.88, 99: 2.33 };
const zFor = (sl: number) => Z_TABLE[sl] ?? 1.65;

export type MrpStatus = "critico" | "atencao" | "normal" | "excesso";

export type MrpRow = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  deposit: string | null;
  supplierId: string | null;
  supplierName: string | null;
  balance: number;
  avgUnitCost: number;
  capitalEmpatado: number;
  dailyConsumption: number;
  monthlyDemand: number;
  annualDemand: number;
  stdDev: number;
  serviceLevel: number;
  z: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  minimum: number;
  eoq: number; // LEC
  maximum: number;
  coverageDays: number | null;
  turnover: number; // giro = consumo anual / estoque médio
  suggestedPurchase: number;
  suggestedValue: number;
  onOrder: number;
  status: MrpStatus;
  hasHistory: boolean;
};

export type MrpSummary = {
  totalSkus: number;
  totalStockValue: number;
  capitalParado: number;
  itemsCritical: number;
  itemsExcess: number;
  itemsAttention: number;
  rupturas: number;
  avgCoverage: number | null;
  suggestedItems: number;
  suggestedValue: number;
};

export type MrpConfig = {
  service_level: number;
  order_cost: number;
  holding_cost_pct: number;
  working_days_per_month: number;
  history_days: number;
};

const DEFAULT_CFG: MrpConfig = {
  service_level: 95,
  order_cost: 10,
  holding_cost_pct: 3.9,
  working_days_per_month: 22,
  history_days: 90,
};

export const getMrpConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MrpConfig> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("mrp_config")
      .select("service_level,order_cost,holding_cost_pct,working_days_per_month,history_days")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_CFG;
    return {
      service_level: Number(data.service_level),
      order_cost: Number(data.order_cost),
      holding_cost_pct: Number(data.holding_cost_pct),
      working_days_per_month: Number(data.working_days_per_month),
      history_days: Number(data.history_days),
    };
  });

export const saveMrpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Partial<MrpConfig>) =>
    z
      .object({
        service_level: z.number().refine((v) => [90, 95, 97, 99].includes(v)).optional(),
        order_cost: z.number().min(0).optional(),
        holding_cost_pct: z.number().min(0).max(100).optional(),
        working_days_per_month: z.number().int().min(1).max(31).optional(),
        history_days: z.number().int().min(30).max(720).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("mrp_config")
      .upsert({ owner_id: userId, ...data }, { onConflict: "owner_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Engine MRP — pure function reutilizável (Copilot, BI, route handlers).
 */
export async function runMrpPlanning(
  supabase: { from: (t: string) => any },
  userId: string,
  data: { category?: string; supplierId?: string; deposit?: string } = {},
): Promise<{ rows: MrpRow[]; summary: MrpSummary; cfg: MrpConfig }> {
    {

    // 1) Config
    const { data: cfgRow } = await supabase
      .from("mrp_config")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();
    const cfg: MrpConfig = cfgRow
      ? {
          service_level: Number(cfgRow.service_level),
          order_cost: Number(cfgRow.order_cost),
          holding_cost_pct: Number(cfgRow.holding_cost_pct),
          working_days_per_month: Number(cfgRow.working_days_per_month),
          history_days: Number(cfgRow.history_days),
        }
      : DEFAULT_CFG;

    // 2) Itens
    let q = supabase
      .from("inventory_items")
      .select(
        "id,sku,name,category,unit,deposit,balance,minimum,preferred_supplier_id,safety_days,mrp_overrides,avg_unit_cost",
      )
      .eq("owner_id", userId);
    if (data.category) q = q.eq("category", data.category as never);
    if (data.supplierId) q = q.eq("preferred_supplier_id", data.supplierId);
    if (data.deposit) q = q.eq("deposit", data.deposit);
    const { data: items, error: iErr } = await q;
    if (iErr) throw new Error(iErr.message);
    const itemList = items ?? [];
    if (itemList.length === 0) {
      return {
        rows: [],
        cfg,
        summary: {
          totalSkus: 0,
          totalStockValue: 0,
          capitalParado: 0,
          itemsCritical: 0,
          itemsExcess: 0,
          itemsAttention: 0,
          rupturas: 0,
          avgCoverage: null,
          suggestedItems: 0,
          suggestedValue: 0,
        },
      };
    }
    const itemIds = itemList.map((i) => i.id);

    // 3) Fornecedores (lead time)
    const supplierIds = Array.from(
      new Set(itemList.map((i) => i.preferred_supplier_id).filter((s): s is string => Boolean(s))),
    );
    const suppliersById = new Map<string, { id: string; name: string; lead_time_days: number | null }>();
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id,name,lead_time_days")
        .in("id", supplierIds);
      for (const s of sups ?? []) suppliersById.set(s.id, s);
    }

    // 4) Movimentos do histórico (saídas) — janela cfg.history_days
    const historyStart = new Date(Date.now() - cfg.history_days * 86400000).toISOString();
    const { data: mvs, error: mErr } = await supabase
      .from("stock_movements")
      .select("inventory_item_id,type,quantity,created_at")
      .eq("owner_id", userId)
      .in("inventory_item_id", itemIds)
      .gte("created_at", historyStart);
    if (mErr) throw new Error(mErr.message);

    // 365d para σ mensal — outra query
    const yearStart = new Date(Date.now() - 365 * 86400000).toISOString();
    const { data: mvsYear } = await supabase
      .from("stock_movements")
      .select("inventory_item_id,type,quantity,created_at")
      .eq("owner_id", userId)
      .in("inventory_item_id", itemIds)
      .gte("created_at", yearStart);

    // 5) Custos médios (purchase_order_items dos últimos 365d)
    const { data: poiCost } = await supabase
      .from("purchase_order_items")
      .select("inventory_item_id,quantity,unit_price,created_at")
      .eq("owner_id", userId)
      .in("inventory_item_id", itemIds)
      .gte("created_at", yearStart);

    // 6) Em pedido (PO em aberto)
    const { data: poItems } = await supabase
      .from("purchase_order_items")
      .select("inventory_item_id,quantity,purchase_orders!inner(status,owner_id)")
      .eq("owner_id", userId)
      .in("inventory_item_id", itemIds);

    // agrega saídas por item
    const out90 = new Map<string, number>();
    for (const m of mvs ?? []) {
      if (m.type !== "saida" || !m.inventory_item_id) continue;
      out90.set(m.inventory_item_id, (out90.get(m.inventory_item_id) ?? 0) + Number(m.quantity ?? 0));
    }

    // agrega por mês (últimos 12 meses) para σ
    const monthly = new Map<string, Map<string, number>>(); // itemId -> {YYYY-MM -> qty}
    for (const m of mvsYear ?? []) {
      if (m.type !== "saida" || !m.inventory_item_id) continue;
      const ym = (m.created_at ?? "").slice(0, 7);
      if (!ym) continue;
      let inner = monthly.get(m.inventory_item_id);
      if (!inner) {
        inner = new Map();
        monthly.set(m.inventory_item_id, inner);
      }
      inner.set(ym, (inner.get(ym) ?? 0) + Number(m.quantity ?? 0));
    }

    // custo médio ponderado
    const costSum = new Map<string, { v: number; q: number }>();
    for (const p of poiCost ?? []) {
      if (!p.inventory_item_id) continue;
      const qty = Number(p.quantity ?? 0);
      const price = Number(p.unit_price ?? 0);
      if (qty <= 0 || price <= 0) continue;
      const cur = costSum.get(p.inventory_item_id) ?? { v: 0, q: 0 };
      cur.v += qty * price;
      cur.q += qty;
      costSum.set(p.inventory_item_id, cur);
    }

    const onOrder = new Map<string, number>();
    for (const it of poItems ?? []) {
      const po = (it as unknown as { purchase_orders: { status: string } | null }).purchase_orders;
      if (!po || po.status === "recebido" || po.status === "cancelado") continue;
      if (!it.inventory_item_id) continue;
      onOrder.set(
        it.inventory_item_id,
        (onOrder.get(it.inventory_item_id) ?? 0) + Number(it.quantity ?? 0),
      );
    }

    // 7) Linhas MRP
    const rows: MrpRow[] = itemList.map((it) => {
      const overrides = (it.mrp_overrides ?? {}) as Record<string, number | undefined>;
      const sup = it.preferred_supplier_id ? suppliersById.get(it.preferred_supplier_id) : null;
      const leadTime =
        Number(overrides.lead_time_days ?? 0) || Number(sup?.lead_time_days ?? 0) || 14;
      const serviceLevel = Number(overrides.service_level ?? cfg.service_level);
      const z = Number(overrides.z ?? zFor(serviceLevel));
      const S = Number(overrides.order_cost ?? cfg.order_cost);
      const Hpct = Number(overrides.holding_cost_pct ?? cfg.holding_cost_pct);
      const workingDays = cfg.working_days_per_month;

      const saidas = out90.get(it.id) ?? 0;
      const daily = cfg.history_days > 0 ? saidas / cfg.history_days : 0;
      const monthlyDemand = daily * workingDays;
      const annualDemand = monthlyDemand * 12;

      // σ mensal: usar 12 meses (mês com 0 conta)
      const months: number[] = [];
      const inner = monthly.get(it.id);
      const today = new Date();
      for (let k = 11; k >= 0; k--) {
        const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push(inner?.get(ym) ?? 0);
      }
      const hasHistory = months.some((m) => m > 0);
      const mean = months.reduce((a, b) => a + b, 0) / months.length;
      const variance = months.reduce((a, b) => a + (b - mean) ** 2, 0) / months.length;
      const stdDev = Math.sqrt(variance);

      const safetyStock = Math.max(0, Math.round(z * stdDev * Math.sqrt(leadTime)));
      const reorderPoint = Math.round(daily * leadTime + safetyStock);
      const minimum = Math.max(reorderPoint, Number(it.minimum ?? 0));

      // LEC
      const H = (Number(it.avg_unit_cost ?? 0) || 1) * (Hpct / 100); // R$/unidade/ano
      const eoq =
        annualDemand > 0 && S > 0 && H > 0 ? Math.ceil(Math.sqrt((2 * annualDemand * S) / H)) : 0;
      const maximum = minimum + eoq;

      // custo médio
      const c = costSum.get(it.id);
      const avgCost = c && c.q > 0 ? c.v / c.q : Number(it.avg_unit_cost ?? 0);
      const balance = Number(it.balance ?? 0);
      const capitalEmpatado = balance * avgCost;

      const coverageDays = daily > 0 ? Math.round(balance / daily) : null;
      const avgStock = (minimum + maximum) / 2;
      const turnover = avgStock > 0 ? annualDemand / avgStock : 0;

      // sugestão
      const ord = onOrder.get(it.id) ?? 0;
      let suggestedPurchase = 0;
      if (balance + ord <= reorderPoint) {
        const gap = maximum - balance - ord;
        suggestedPurchase = Math.max(eoq, gap > 0 ? gap : 0);
      }

      let status: MrpStatus;
      if (balance > maximum && maximum > 0) status = "excesso";
      else if (balance <= reorderPoint) status = "critico";
      else if (coverageDays !== null && coverageDays < 15) status = "atencao";
      else status = "normal";

      return {
        id: it.id,
        sku: it.sku,
        name: it.name,
        category: (it.category as string) ?? null,
        unit: it.unit ?? "un",
        deposit: it.deposit ?? null,
        supplierId: it.preferred_supplier_id ?? null,
        supplierName: sup?.name ?? null,
        balance,
        avgUnitCost: Number(avgCost.toFixed(4)),
        capitalEmpatado: Number(capitalEmpatado.toFixed(2)),
        dailyConsumption: Number(daily.toFixed(2)),
        monthlyDemand: Number(monthlyDemand.toFixed(0)),
        annualDemand: Number(annualDemand.toFixed(0)),
        stdDev: Number(stdDev.toFixed(2)),
        serviceLevel,
        z,
        leadTimeDays: leadTime,
        safetyStock,
        reorderPoint,
        minimum,
        eoq,
        maximum,
        coverageDays,
        turnover: Number(turnover.toFixed(2)),
        suggestedPurchase,
        suggestedValue: Number((suggestedPurchase * avgCost).toFixed(2)),
        onOrder: ord,
        status,
        hasHistory,
      };
    });

    // 8) Summary
    const covs = rows.map((r) => r.coverageDays).filter((c): c is number => c !== null);
    const summary: MrpSummary = {
      totalSkus: rows.length,
      totalStockValue: Number(rows.reduce((a, r) => a + r.capitalEmpatado, 0).toFixed(2)),
      capitalParado: Number(
        rows
          .filter((r) => r.status === "excesso" || (r.coverageDays !== null && r.coverageDays > 120))
          .reduce((a, r) => a + r.capitalEmpatado, 0)
          .toFixed(2),
      ),
      itemsCritical: rows.filter((r) => r.status === "critico").length,
      itemsExcess: rows.filter((r) => r.status === "excesso").length,
      itemsAttention: rows.filter((r) => r.status === "atencao").length,
      rupturas: rows.filter((r) => r.balance <= 0 && r.dailyConsumption > 0).length,
      avgCoverage:
        covs.length > 0
          ? Number((covs.reduce((a, b) => a + b, 0) / covs.length).toFixed(1))
          : null,
      suggestedItems: rows.filter((r) => r.suggestedPurchase > 0).length,
      suggestedValue: Number(
        rows.reduce((a, r) => a + r.suggestedValue, 0).toFixed(2),
      ),
    };

    rows.sort((a, b) => {
      const order = { critico: 0, atencao: 1, normal: 2, excesso: 3 } as const;
      return order[a.status] - order[b.status] || b.suggestedValue - a.suggestedValue;
    });

    return { rows, cfg, summary };
  });
