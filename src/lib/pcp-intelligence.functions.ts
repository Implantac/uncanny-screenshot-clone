import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * IA-PCP — Finite Capacity Scheduling
 *
 * Calcula, para cada fornecedor:
 *  - WIP atual (peças em ordens ativas)
 *  - capacidade diária declarada (supplier_capacity.pieces_per_day)
 *  - dias úteis necessários para zerar fila
 *  - ocupação % (carga / capacidade da janela até due_date mais distante)
 *  - data prevista de conclusão por OP (acumulada em fila FIFO por prioridade/due)
 *  - sugestões de rebalanceamento quando ocupação > 100%
 */

type CapacityRow = {
  supplier_id: string;
  pieces_per_day: number;
  working_days_per_week: number;
};
type OrderRow = {
  id: string;
  code: string | null;
  quantity: number;
  progress: number;
  due_date: string | null;
  status: string;
  priority: number | null;
  supplier_id: string | null;
  suppliers?: { name: string | null } | null;
};

const ACTIVE_STATUS = ["aguardando", "em_producao", "atrasada"] as const;

function addBusinessDays(from: Date, days: number, workingDaysPerWeek: number): Date {
  const d = new Date(from);
  if (days <= 0) return d;
  const ratio = workingDaysPerWeek > 0 ? 7 / workingDaysPerWeek : 7 / 5;
  const calendarDays = Math.ceil(days * ratio);
  d.setDate(d.getDate() + calendarDays);
  return d;
}

export const getPcpIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => z.object({}).parse({}))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: caps }, { data: orders }] = await Promise.all([
      supabase
        .from("supplier_capacity")
        .select("supplier_id, pieces_per_day, working_days_per_week")
        .eq("owner_id", userId),
      supabase
        .from("production_orders")
        .select(
          "id, code, quantity, progress, due_date, status, priority, supplier_id, suppliers(name)",
        )
        .eq("owner_id", userId)
        .in("status", ACTIVE_STATUS)
        .order("priority", { ascending: false, nullsFirst: false })
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);

    const capMap = new Map<string, CapacityRow>();
    (caps ?? []).forEach((c) => capMap.set(c.supplier_id, c as CapacityRow));

    type SupplierLoad = {
      supplier_id: string;
      supplier_name: string;
      orders: number;
      wip_pieces: number;
      pieces_per_day: number;
      working_days_per_week: number;
      days_to_clear: number;
      occupancy_pct: number;
      next_orders: Array<{
        id: string;
        code: string | null;
        quantity_remaining: number;
        due_date: string | null;
        forecast_done: string;
        risk: "ontime" | "tight" | "late";
      }>;
    };

    const bySupplier = new Map<string, SupplierLoad>();
    const today = new Date();

    (orders as OrderRow[] | null ?? []).forEach((o) => {
      const sid = o.supplier_id ?? "_none";
      const sname = o.suppliers?.name ?? "Sem fornecedor";
      const cap = capMap.get(sid);
      const ppd = cap?.pieces_per_day ?? 0;
      const wdpw = cap?.working_days_per_week ?? 5;

      let load = bySupplier.get(sid);
      if (!load) {
        load = {
          supplier_id: sid,
          supplier_name: sname,
          orders: 0,
          wip_pieces: 0,
          pieces_per_day: ppd,
          working_days_per_week: wdpw,
          days_to_clear: 0,
          occupancy_pct: 0,
          next_orders: [],
        };
        bySupplier.set(sid, load);
      }
      const remaining = Math.max(0, Math.round(o.quantity * (1 - (o.progress || 0) / 100)));
      load.orders += 1;
      load.wip_pieces += remaining;
    });

    // Forecast por OP (FIFO em fila já ordenada por prioridade/due)
    (orders as OrderRow[] | null ?? []).forEach((o) => {
      const sid = o.supplier_id ?? "_none";
      const load = bySupplier.get(sid)!;
      const remaining = Math.max(0, Math.round(o.quantity * (1 - (o.progress || 0) / 100)));
      const ppd = load.pieces_per_day;
      const cumulative = load.next_orders.reduce((s, x) => s + x.quantity_remaining, 0) + remaining;
      const daysNeeded = ppd > 0 ? cumulative / ppd : Number.POSITIVE_INFINITY;
      const forecast = ppd > 0 ? addBusinessDays(today, daysNeeded, load.working_days_per_week) : null;
      const due = o.due_date ? new Date(o.due_date) : null;
      let risk: "ontime" | "tight" | "late" = "ontime";
      if (forecast && due) {
        const diff = (due.getTime() - forecast.getTime()) / 86400000;
        if (diff < 0) risk = "late";
        else if (diff < 3) risk = "tight";
      } else if (!ppd) {
        risk = "tight";
      }
      load.next_orders.push({
        id: o.id,
        code: o.code,
        quantity_remaining: remaining,
        due_date: o.due_date,
        forecast_done: forecast ? forecast.toISOString().slice(0, 10) : "sem capacidade",
        risk,
      });
    });

    // Ocupação / dias para zerar fila
    bySupplier.forEach((load) => {
      if (load.pieces_per_day > 0) {
        load.days_to_clear = +(load.wip_pieces / load.pieces_per_day).toFixed(1);
        // Ocupação = carga / capacidade semanal × dias úteis percorridos até a OP mais distante (cap 4 semanas)
        const weeklyCap = load.pieces_per_day * load.working_days_per_week;
        const horizonWeeks = 4;
        load.occupancy_pct = Math.round(
          (load.wip_pieces / Math.max(1, weeklyCap * horizonWeeks)) * 100,
        );
      } else {
        load.occupancy_pct = load.wip_pieces > 0 ? 999 : 0;
      }
    });

    // Sugestões IA: realocar de fornecedor estourado para um com folga
    const list = Array.from(bySupplier.values()).filter((s) => s.supplier_id !== "_none");
    const overloaded = list.filter((s) => s.occupancy_pct > 100).sort((a, b) => b.occupancy_pct - a.occupancy_pct);
    const free = list
      .filter((s) => s.pieces_per_day > 0 && s.occupancy_pct < 70)
      .sort((a, b) => a.occupancy_pct - b.occupancy_pct);

    const suggestions: Array<{
      from_supplier: string;
      to_supplier: string;
      order_code: string | null;
      order_id: string;
      pieces: number;
      reason: string;
    }> = [];

    overloaded.forEach((over) => {
      const lateOrder = over.next_orders.find((o) => o.risk === "late");
      const target = free[0];
      if (lateOrder && target) {
        suggestions.push({
          from_supplier: over.supplier_name,
          to_supplier: target.supplier_name,
          order_code: lateOrder.code,
          order_id: lateOrder.id,
          pieces: lateOrder.quantity_remaining,
          reason: `${over.supplier_name} a ${over.occupancy_pct}% — ${target.supplier_name} a ${target.occupancy_pct}% (folga ${Math.max(0, 100 - target.occupancy_pct)}%)`,
        });
      }
    });

    const totalWip = list.reduce((s, x) => s + x.wip_pieces, 0);
    const totalCap = list.reduce((s, x) => s + x.pieces_per_day * x.working_days_per_week * 4, 0);
    const avgOccupancy = totalCap > 0 ? Math.round((totalWip / totalCap) * 100) : 0;
    const lateForecasts = list.flatMap((s) => s.next_orders).filter((o) => o.risk === "late").length;

    return {
      kpis: {
        suppliers_tracked: list.length,
        avg_occupancy_pct: avgOccupancy,
        wip_total: totalWip,
        late_forecasts: lateForecasts,
        unmapped_capacity: list.filter((s) => s.pieces_per_day === 0).length,
      },
      suppliers: list.sort((a, b) => b.occupancy_pct - a.occupancy_pct),
      suggestions,
    };
  });

const UpsertCap = z.object({
  supplier_id: z.string().uuid(),
  pieces_per_day: z.number().int().min(0).max(100000),
  working_days_per_week: z.number().int().min(1).max(7).default(5),
});

export const upsertSupplierCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertCap.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("supplier_capacity")
      .upsert(
        {
          owner_id: userId,
          supplier_id: data.supplier_id,
          pieces_per_day: data.pieces_per_day,
          working_days_per_week: data.working_days_per_week,
        },
        { onConflict: "owner_id,supplier_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
