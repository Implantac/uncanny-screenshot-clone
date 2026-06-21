import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Reposição dinâmica + ABC + Contagem cíclica.
 * ROP = (consumo_diario * lead_time) + safety_stock
 * safety_stock = consumo_diario * safety_days
 * EOQ simplificado: cobertura 30d além do ROP.
 */
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
        "id, sku, name, unit, category, balance, minimum, maximum, safety_days, preferred_supplier_id, suppliers:preferred_supplier_id(name,lead_time_days)",
      )
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    const list = items ?? [];
    if (list.length === 0) return { items: [], windowDays: data.windowDays };

    const ids = list.map((i) => i.id);
    const { data: moves, error: mErr } = await supabase
      .from("stock_movements")
      .select("inventory_item_id, type, quantity, created_at")
      .eq("owner_id", userId)
      .eq("type", "saida")
      .in("inventory_item_id", ids)
      .gte("created_at", since);
    if (mErr) throw new Error(mErr.message);

    const consByItem = new Map<string, number>();
    for (const m of moves ?? []) {
      consByItem.set(
        m.inventory_item_id,
        (consByItem.get(m.inventory_item_id) ?? 0) + Number(m.quantity ?? 0),
      );
    }

    const rows = list.map((it: any) => {
      const totalCons = consByItem.get(it.id) ?? 0;
      const daily = totalCons / data.windowDays;
      const leadTime = Number(it.suppliers?.lead_time_days ?? 14);
      const safetyDays = Number(it.safety_days ?? 7);
      const safetyStock = daily * safetyDays;
      const rop = Math.ceil(daily * leadTime + safetyStock);
      const target = Math.ceil(rop + daily * 30); // cobertura 30d acima do ROP
      const balance = Number(it.balance ?? 0);
      const currentMin = Number(it.minimum ?? 0);
      const deltaMin = rop - currentMin;
      const status: "ok" | "rever" | "critico" =
        balance <= 0
          ? "critico"
          : balance < rop
            ? "critico"
            : Math.abs(deltaMin) > Math.max(2, rop * 0.25)
              ? "rever"
              : "ok";
      const reason =
        daily <= 0
          ? "Sem consumo na janela — manter mínimo manual"
          : `consumo ${daily.toFixed(2)} ${it.unit}/dia · lead ${leadTime}d · segurança ${safetyDays}d → ROP ${rop}` +
            (currentMin !== rop ? ` (atual ${currentMin})` : "");
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
        dailyConsumption: Number(daily.toFixed(3)),
        leadTimeDays: leadTime,
        safetyDays,
        supplier: it.suppliers?.name ?? null,
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
