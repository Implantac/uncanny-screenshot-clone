import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiReason } from "@/lib/ai-reason";
import { z } from "zod";

/**
 * Reposição dinâmica + ABC + Contagem cíclica.
 * Safety stock estatístico = Z * σ_diário * √leadTime
 * ROP = (consumo_diário * leadTime) + safety_stock
 * EOQ (LEC) = √((2 * D_anual * S) / H)  — quando S e H disponíveis em mrp_overrides
 * Fallback: cobertura 30d acima do ROP.
 */

type ReorderOverrides = {
  service_factor_z?: number;
  cost_per_order?: number;
  holding_cost_annual?: number;
};

/** Defaults aplicados sempre que mrp_overrides estiver vazio ou inválido. */
export const REORDER_DEFAULTS = {
  service_factor_z: 1.65, // 95% de nível de serviço
  cost_per_order: 0,
  holding_cost_annual: 0,
  safety_days: 7,
} as const;

/** Faixas realistas — validadas no servidor e exibidas no painel. */
export const REORDER_LIMITS = {
  service_factor_z: { min: 0, max: 4, label: "Fator Z (0 a 4 · até 99.99% de serviço)" },
  cost_per_order: { min: 0, max: 100_000, label: "Custo do pedido S (R$ 0 a 100.000)" },
  holding_cost_annual: {
    min: 0,
    max: 10_000,
    label: "Custo armazenagem H (R$/un/ano · 0 a 10.000)",
  },
  safety_days: { min: 0, max: 365, label: "Dias de segurança (0 a 365)" },
  lead_time_days: { min: 1, max: 365, label: "Lead time fornecedor (1 a 365 dias)" },
  daily_avg_sales: { min: 0, max: 100_000, label: "Consumo médio diário (0 a 100.000)" },
} as const;

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}

/** Aceita valor numérico finito > 0; caso contrário, devolve o fallback. */
function pickPositive(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : fallback;
}

/** Aceita valor numérico finito >= 0; caso contrário, devolve o fallback. */
function pickNonNeg(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) && (n as number) >= 0 ? (n as number) : fallback;
}

/** Normaliza overrides — protege contra jsonb corrompido, strings ou NaN; clampa para faixa realista. */
export function resolveReorderParams(
  overrides: unknown,
): { Z: number; S: number; H: number } {
  const ov = (overrides && typeof overrides === "object" ? overrides : {}) as ReorderOverrides;
  const Z = pickPositive(ov.service_factor_z, REORDER_DEFAULTS.service_factor_z);
  const S = pickNonNeg(ov.cost_per_order, REORDER_DEFAULTS.cost_per_order);
  const H = pickNonNeg(ov.holding_cost_annual, REORDER_DEFAULTS.holding_cost_annual);
  return {
    Z: inRange(Z, REORDER_LIMITS.service_factor_z.min, REORDER_LIMITS.service_factor_z.max)
      ? Z
      : REORDER_DEFAULTS.service_factor_z,
    S: inRange(S, REORDER_LIMITS.cost_per_order.min, REORDER_LIMITS.cost_per_order.max)
      ? S
      : REORDER_DEFAULTS.cost_per_order,
    H: inRange(H, REORDER_LIMITS.holding_cost_annual.min, REORDER_LIMITS.holding_cost_annual.max)
      ? H
      : REORDER_DEFAULTS.holding_cost_annual,
  };
}


export const updateReorderParams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      itemId: string;
      serviceFactorZ?: number | null;
      costPerOrder?: number | null;
      holdingCostAnnual?: number | null;
      safetyDays?: number | null;
    }) =>
      z
        .object({
          itemId: z.string().uuid(),
          serviceFactorZ: z.number().min(0).max(5).nullable().optional(),
          costPerOrder: z.number().min(0).nullable().optional(),
          holdingCostAnnual: z.number().min(0).nullable().optional(),
          safetyDays: z.number().int().min(0).max(365).nullable().optional(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur, error: rErr } = await supabase
      .from("inventory_items")
      .select("mrp_overrides")
      .eq("id", data.itemId)
      .eq("owner_id", userId)
      .single();
    if (rErr) throw new Error(rErr.message);
    const raw = cur?.mrp_overrides;
    const base =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as ReorderOverrides) : {};
    const overrides: ReorderOverrides = { ...base };
    if (data.serviceFactorZ != null && Number.isFinite(data.serviceFactorZ))
      overrides.service_factor_z = data.serviceFactorZ;
    if (data.costPerOrder != null && Number.isFinite(data.costPerOrder))
      overrides.cost_per_order = data.costPerOrder;
    if (data.holdingCostAnnual != null && Number.isFinite(data.holdingCostAnnual))
      overrides.holding_cost_annual = data.holdingCostAnnual;
    const patch: { mrp_overrides: ReorderOverrides; safety_days?: number } = {
      mrp_overrides: overrides,
    };
    if (data.safetyDays != null) patch.safety_days = data.safetyDays;
    const { error } = await supabase
      .from("inventory_items")
      .update(patch)
      .eq("id", data.itemId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDynamicReorderSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i?: { windowDays?: number }) =>
    z.object({ windowDays: z.number().int().min(7).max(180).default(60) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.windowDays * 86400_000).toISOString();

    const { data: items, error } = await supabase
      .from("inventory_items")
      .select(
        "id, sku, name, unit, category, balance, minimum, maximum, safety_days, mrp_overrides, avg_unit_cost, preferred_supplier_id, suppliers:preferred_supplier_id(name,lead_time_days)",
      )
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    const list = items ?? [];
    if (list.length === 0)
      return {
        items: [],
        windowDays: data.windowDays,
        counts: { critico: 0, rever: 0, ok: 0 },
      };

    const ids = list.map((i) => i.id);
    const { data: moves, error: mErr } = await supabase
      .from("stock_movements")
      .select("inventory_item_id, type, quantity, created_at")
      .eq("owner_id", userId)
      .eq("type", "saida")
      .in("inventory_item_id", ids)
      .gte("created_at", since);
    if (mErr) throw new Error(mErr.message);

    const dailyMap = new Map<string, Map<string, number>>();
    for (const m of moves ?? []) {
      const d = new Date(m.created_at).toISOString().slice(0, 10);
      let perDay = dailyMap.get(m.inventory_item_id);
      if (!perDay) {
        perDay = new Map();
        dailyMap.set(m.inventory_item_id, perDay);
      }
      perDay.set(d, (perDay.get(d) ?? 0) + Number(m.quantity ?? 0));
    }

    const rows = list.map((it: any) => {
      const perDay = dailyMap.get(it.id) ?? new Map<string, number>();
      const totalDays = data.windowDays;
      const series: number[] = [];
      const now = Date.now();
      for (let k = 0; k < totalDays; k++) {
        const d = new Date(now - k * 86400_000).toISOString().slice(0, 10);
        series.push(perDay.get(d) ?? 0);
      }
      const totalCons = series.reduce((a, b) => a + b, 0);
      const dailyAvg = totalCons / totalDays;
      const variance =
        series.length > 1
          ? series.reduce((s, x) => s + (x - dailyAvg) ** 2, 0) / (series.length - 1)
          : 0;
      const sigma = Math.sqrt(variance);

      const { Z, S, H } = resolveReorderParams(it.mrp_overrides);
      const leadTimeRaw = Number(it.suppliers?.lead_time_days);
      const leadTime = Number.isFinite(leadTimeRaw) && leadTimeRaw > 0 ? leadTimeRaw : 14;
      const safetyDaysRaw = Number(it.safety_days);
      const safetyDays =
        Number.isFinite(safetyDaysRaw) && safetyDaysRaw >= 0
          ? safetyDaysRaw
          : REORDER_DEFAULTS.safety_days;

      const safetyStockStat = Z * sigma * Math.sqrt(leadTime);
      const safetyStockDet = dailyAvg * safetyDays;
      const safetyStock =
        sigma > 0 ? Math.max(safetyStockStat, safetyStockDet * 0.5) : safetyStockDet;

      const rop = Math.ceil(dailyAvg * leadTime + safetyStock);

      const annualDemand = dailyAvg * 365;
      const eoq =
        S > 0 && H > 0 && annualDemand > 0 ? Math.sqrt((2 * annualDemand * S) / H) : 0;
      const eoqCeil = eoq > 0 ? Math.ceil(eoq) : 0;
      const target = eoqCeil > 0 ? rop + eoqCeil : Math.ceil(rop + dailyAvg * 30);

      const balance = Number(it.balance ?? 0);
      const currentMin = Number(it.minimum ?? 0);
      const deltaMin = rop - currentMin;
      const needsOrder = balance <= rop && dailyAvg > 0;
      const status: "ok" | "rever" | "critico" =
        balance <= 0 && dailyAvg > 0
          ? "critico"
          : needsOrder
            ? "critico"
            : Math.abs(deltaMin) > Math.max(2, rop * 0.25)
              ? "rever"
              : "ok";

      const sigmaPart = sigma > 0 ? `σ ${sigma.toFixed(2)}` : "σ ~0";
      const eoqPart = eoqCeil > 0 ? `LEC ${eoqCeil}` : "LEC: defina S e H";
      const reason =
        dailyAvg <= 0
          ? buildAiReason({
              signals: ["sem consumo na janela"],
              recommendation: "manter mínimo manual até observar giro",
            })
          : buildAiReason({
              signals: [
                `consumo ${dailyAvg.toFixed(2)} ${it.unit}/dia`,
                `lead ${leadTime}d`,
                `Z ${Z}`,
                sigmaPart,
                eoqPart,
              ],
              recommendation: needsOrder
                ? `emitir pedido — comprar ${eoqCeil > 0 ? eoqCeil : Math.ceil(rop)} ${it.unit}`
                : `ajustar mínimo p/ ${rop} (ROP)`,
            });

      return {
        id: it.id,
        sku: it.sku,
        name: it.name,
        unit: it.unit,
        category: it.category,
        balance,
        currentMin,
        suggestedMin: rop,
        suggestedMax: target,
        deltaMin,
        dailyConsumption: Number(dailyAvg.toFixed(3)),
        sigmaDaily: Number(sigma.toFixed(3)),
        leadTimeDays: leadTime,
        safetyDays,
        safetyStock: Math.ceil(safetyStock),
        rop,
        eoq: eoqCeil,
        annualDemand: Math.round(annualDemand),
        serviceFactorZ: Z,
        costPerOrder: S,
        holdingCostAnnual: H,
        supplier: it.suppliers?.name ?? null,
        needsOrder,
        status,
        reason,
      };
    });

    rows.sort((a, b) => {
      const order = { critico: 0, rever: 1, ok: 2 } as const;
      return order[a.status] - order[b.status] || b.dailyConsumption - a.dailyConsumption;
    });

    return {
      windowDays: data.windowDays,
      items: rows,
      counts: {
        critico: rows.filter((r) => r.status === "critico").length,
        rever: rows.filter((r) => r.status === "rever").length,
        ok: rows.filter((r) => r.status === "ok").length,
      },
    };
  });

export const applyReorderSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { itemId: string; minimum: number; maximum?: number | null }) =>
    z
      .object({
        itemId: z.string().uuid(),
        minimum: z.number().int().nonnegative(),
        maximum: z.number().int().nonnegative().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload: { minimum: number; maximum?: number } = { minimum: data.minimum };
    if (data.maximum != null) payload.maximum = data.maximum;
    const { error } = await context.supabase
      .from("inventory_items")
      .update(payload)
      .eq("id", data.itemId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Classificação ABC + agenda de contagem cíclica.
 * A: top 80% giro (contar mensal) · B: 15% (trimestral) · C: 5% (semestral).
 */
export const getCycleCountPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i?: { windowDays?: number }) =>
    z.object({ windowDays: z.number().int().min(30).max(365).default(90) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.windowDays * 86400_000).toISOString();

    const { data: items, error } = await supabase
      .from("inventory_items")
      .select("id, sku, name, unit, balance")
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    const list = (items ?? []) as Array<{
      id: string;
      sku: string;
      name: string;
      unit: string;
      balance: number;
    }>;

    const { data: moves } = await supabase
      .from("stock_movements")
      .select("inventory_item_id, quantity, type, created_at")
      .eq("owner_id", userId)
      .eq("type", "saida")
      .in(
        "inventory_item_id",
        list.map((i) => i.id),
      )
      .gte("created_at", since);

    const turnoverById = new Map<string, number>();
    for (const m of moves ?? []) {
      turnoverById.set(
        m.inventory_item_id,
        (turnoverById.get(m.inventory_item_id) ?? 0) + Number(m.quantity ?? 0),
      );
    }

    const enriched = list.map((it) => ({
      ...it,
      turnover: turnoverById.get(it.id) ?? 0,
    }));
    enriched.sort((a, b) => b.turnover - a.turnover);
    const totalTurn = enriched.reduce((s, i) => s + i.turnover, 0) || 1;

    let acc = 0;
    const ranked = enriched.map((it) => {
      acc += it.turnover;
      const pct = acc / totalTurn;
      const abc: "A" | "B" | "C" = pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
      const cadence = abc === "A" ? 30 : abc === "B" ? 90 : 180;
      return { ...it, abc, cadenceDays: cadence };
    });

    // últimas contagens
    const { data: lastCounts } = await supabase
      .from("inventory_cycle_counts")
      .select("inventory_item_id, counted_at, variance, variance_pct")
      .eq("owner_id", userId)
      .in(
        "inventory_item_id",
        ranked.map((r) => r.id),
      )
      .order("counted_at", { ascending: false });
    const lastById = new Map<string, { at: string; variance: number; pct: number | null }>();
    for (const c of lastCounts ?? []) {
      if (!lastById.has(c.inventory_item_id)) {
        lastById.set(c.inventory_item_id, {
          at: c.counted_at,
          variance: Number(c.variance ?? 0),
          pct: c.variance_pct == null ? null : Number(c.variance_pct),
        });
      }
    }

    const now = Date.now();
    const plan = ranked.map((r) => {
      const last = lastById.get(r.id);
      const lastAt = last?.at ?? null;
      const daysSince = lastAt
        ? Math.floor((now - new Date(lastAt).getTime()) / 86400_000)
        : null;
      const overdue = daysSince == null || daysSince >= r.cadenceDays;
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        unit: r.unit,
        balance: Number(r.balance ?? 0),
        abc: r.abc,
        cadenceDays: r.cadenceDays,
        turnover: r.turnover,
        lastCountedAt: lastAt,
        daysSinceLastCount: daysSince,
        lastVariance: last?.variance ?? null,
        overdue,
      };
    });

    plan.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const ord = { A: 0, B: 1, C: 2 } as const;
      return ord[a.abc] - ord[b.abc] || b.turnover - a.turnover;
    });

    return {
      windowDays: data.windowDays,
      counts: {
        A: plan.filter((p) => p.abc === "A").length,
        B: plan.filter((p) => p.abc === "B").length,
        C: plan.filter((p) => p.abc === "C").length,
        overdue: plan.filter((p) => p.overdue).length,
      },
      plan: plan.slice(0, 50),
    };
  });

export const registerCycleCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      itemId: string;
      abcClass: "A" | "B" | "C";
      countedBalance: number;
      notes?: string | null;
      adjustStock?: boolean;
    }) =>
      z
        .object({
          itemId: z.string().uuid(),
          abcClass: z.enum(["A", "B", "C"]),
          countedBalance: z.number().nonnegative(),
          notes: z.string().max(500).nullable().optional(),
          adjustStock: z.boolean().optional().default(false),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: item, error: iErr } = await supabase
      .from("inventory_items")
      .select("balance")
      .eq("id", data.itemId)
      .eq("owner_id", userId)
      .single();
    if (iErr) throw new Error(iErr.message);
    const expected = Number(item?.balance ?? 0);
    const variance = data.countedBalance - expected;
    const variancePct = expected > 0 ? (variance / expected) * 100 : null;

    const { error } = await supabase.from("inventory_cycle_counts").insert({
      owner_id: userId,
      inventory_item_id: data.itemId,
      abc_class: data.abcClass,
      expected_balance: expected,
      counted_balance: data.countedBalance,
      variance_pct: variancePct,
      notes: data.notes ?? null,
      counted_by: userId,
    });
    if (error) throw new Error(error.message);

    if (data.adjustStock && Math.abs(variance) > 0.0001) {
      const { error: mvErr } = await supabase.from("stock_movements").insert({
        owner_id: userId,
        inventory_item_id: data.itemId,
        type: "ajuste",
        quantity: data.countedBalance,
        reference_kind: "cycle_count",
        notes: `Ajuste por contagem cíclica (variância ${variance.toFixed(2)})`,
      });
      if (mvErr) throw new Error(mvErr.message);
    }

    return { ok: true, variance, variancePct };
  });
