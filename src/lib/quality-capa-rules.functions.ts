import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CapaRules = {
  enabled: boolean;
  fpy_threshold: number;
  max_critical_defects: number;
  min_occurrences: number;
  window_days: number;
  min_inspections: number;
};

const DEFAULTS: CapaRules = {
  enabled: true,
  fpy_threshold: 80,
  max_critical_defects: 0,
  min_occurrences: 3,
  window_days: 90,
  min_inspections: 3,
};

export const getCapaRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CapaRules> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("quality_capa_rules")
      .select("enabled, fpy_threshold, max_critical_defects, min_occurrences, window_days, min_inspections")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!data) return DEFAULTS;
    return {
      enabled: data.enabled,
      fpy_threshold: Number(data.fpy_threshold),
      max_critical_defects: Number(data.max_critical_defects),
      min_occurrences: Number(data.min_occurrences),
      window_days: Number(data.window_days),
      min_inspections: Number(data.min_inspections),
    };
  });

const RulesSchema = z.object({
  enabled: z.boolean(),
  fpy_threshold: z.number().min(0).max(100),
  max_critical_defects: z.number().int().min(0).max(999),
  min_occurrences: z.number().int().min(1).max(999),
  window_days: z.number().int().min(7).max(365),
  min_inspections: z.number().int().min(1).max(999),
});

export const saveCapaRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RulesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("quality_capa_rules")
      .upsert({ owner_id: userId, ...data }, { onConflict: "owner_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SimulationRow = {
  productId: string;
  productName: string;
  sku: string | null;
  fpy: number;
  inspections: number;
  criticalDefects: number;
  occurrences: number;
  shipmentsInWindow: number;
  wouldTrigger: boolean;
  reasons: string[];
};

export type SimulationResult = {
  rows: SimulationRow[];
  summary: {
    totalProducts: number;
    triggered: number;
    shipmentsAffected: number;
  };
};

export const simulateCapaRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RulesSchema.parse(d))
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.window_days * 86400_000).toISOString();

    const [{ data: products }, { data: orders }, { data: insps }, { data: occs }, { data: shipments }] =
      await Promise.all([
        supabase.from("products").select("id, name, sku").eq("owner_id", userId),
        supabase
          .from("production_orders")
          .select("id, product_id")
          .eq("owner_id", userId),
        supabase
          .from("quality_inspections")
          .select("production_order_id, result, critical_defects, created_at")
          .eq("owner_id", userId)
          .gte("created_at", since),
        supabase
          .from("production_occurrences")
          .select("production_order_id, created_at")
          .eq("owner_id", userId)
          .gte("created_at", since),
        supabase
          .from("influencer_shipments")
          .select("product_id, shipped_at, created_at")
          .eq("owner_id", userId)
          .gte("created_at", since),
      ]);

    const orderToProduct = new Map<string, string>();
    (orders ?? []).forEach((o: any) => {
      if (o.product_id) orderToProduct.set(o.id, o.product_id);
    });

    type Agg = { total: number; approved: number; crit: number; occs: number; ships: number };
    const agg = new Map<string, Agg>();
    const get = (pid: string): Agg => {
      let a = agg.get(pid);
      if (!a) {
        a = { total: 0, approved: 0, crit: 0, occs: 0, ships: 0 };
        agg.set(pid, a);
      }
      return a;
    };

    (insps ?? []).forEach((i: any) => {
      const pid = orderToProduct.get(i.production_order_id);
      if (!pid) return;
      const a = get(pid);
      a.total++;
      if (i.result === "aprovado" || i.result === "aprovada") a.approved++;
      a.crit += Number(i.critical_defects ?? 0);
    });

    (occs ?? []).forEach((o: any) => {
      const pid = orderToProduct.get(o.production_order_id);
      if (!pid) return;
      get(pid).occs++;
    });

    (shipments ?? []).forEach((s: any) => {
      if (!s.product_id) return;
      get(s.product_id).ships++;
    });

    const prodMap = new Map<string, any>();
    (products ?? []).forEach((p: any) => prodMap.set(p.id, p));

    const rows: SimulationRow[] = [];
    let shipmentsAffected = 0;

    for (const [pid, a] of agg.entries()) {
      const p = prodMap.get(pid);
      if (!p) continue;
      const fpy = a.total > 0 ? (a.approved / a.total) * 100 : 100;
      const reasons: string[] = [];
      if (a.crit > data.max_critical_defects)
        reasons.push(`${a.crit} defeitos críticos (máx ${data.max_critical_defects})`);
      if (a.total >= data.min_inspections && fpy < data.fpy_threshold)
        reasons.push(`FPY ${fpy.toFixed(0)}% < ${data.fpy_threshold}% (${a.total} inspeções)`);
      if (a.occs >= data.min_occurrences)
        reasons.push(`${a.occs} ocorrências ≥ ${data.min_occurrences}`);

      const wouldTrigger = reasons.length > 0;
      if (wouldTrigger) shipmentsAffected += a.ships;

      // só exibir produtos relevantes (com algum sinal)
      if (a.total === 0 && a.occs === 0 && a.crit === 0 && a.ships === 0) continue;

      rows.push({
        productId: pid,
        productName: p.name,
        sku: p.sku,
        fpy,
        inspections: a.total,
        criticalDefects: a.crit,
        occurrences: a.occs,
        shipmentsInWindow: a.ships,
        wouldTrigger,
        reasons,
      });
    }

    rows.sort((a, b) => {
      if (a.wouldTrigger !== b.wouldTrigger) return a.wouldTrigger ? -1 : 1;
      return b.shipmentsInWindow - a.shipmentsInWindow;
    });

    return {
      rows: rows.slice(0, 50),
      summary: {
        totalProducts: rows.length,
        triggered: rows.filter((r) => r.wouldTrigger).length,
        shipmentsAffected,
      },
    };
  });
