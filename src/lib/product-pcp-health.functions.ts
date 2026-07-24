/**
 * PCP Health por Produto — visão consolidada da saúde produtiva de UM produto.
 *
 * Consolida OPs abertas, WIP por setor, tempo médio por etapa vs SLA,
 * gargalo dominante, on-time %, saúde de reservas de material e uma
 * recomendação de foco. Consumido pelo tab "PCP" do Product Workspace.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type StageHealth = {
  stage_key: string;
  stage_label: string;
  wip_orders: number;
  wip_qty: number;
  avg_dwell_days: number | null;
  sla_days: number | null;
  breach: boolean;
};

export type ProductPcpHealth = {
  product_id: string;
  open_orders: number;
  open_qty: number;
  late_orders: number;
  on_time_pct: number | null;
  bottleneck: { stage_key: string; stage_label: string; reason: string } | null;
  stages: StageHealth[];
  reservations: {
    total: number;
    active: number;
    shortage_items: number;
    coverage_pct: number | null;
  };
  recent_occurrences: number;
  focus: string;
};

const input = z.object({ productId: z.string().uuid() });

export const getProductPcpHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<ProductPcpHealth> => {
    const { supabase } = context;
    const productId = data.productId;

    const [
      { data: stagesCfg },
      { data: routing },
      { data: orders },
      { data: reservations },
    ] = await Promise.all([
      supabase
        .from("pcp_stages")
        .select("key, label, position")
        .eq("active", true)
        .order("position"),
      supabase
        .from("product_routing")
        .select("stage_key, sla_days, sequence")
        .eq("product_id", productId),
      supabase
        .from("production_orders")
        .select(
          "id, code, quantity, status, stage, stage_updated_at, due_date, created_at",
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("material_reservations")
        .select("id, status, qty_required, qty_reserved, qty_consumed, production_order_id")
        .in(
          "production_order_id",
          // sub-select workaround: fetched via ops below
          [] as string[],
        ),
    ]);

    const openStatuses = new Set(["aguardando", "em_producao", "em_andamento"]);
    const openOps = (orders ?? []).filter((o) => openStatuses.has(o.status as string));
    const openOrders = openOps.length;
    const openQty = openOps.reduce((s, o) => s + Number(o.quantity ?? 0), 0);

    const now = Date.now();
    const lateOps = openOps.filter(
      (o) => o.due_date && new Date(o.due_date as string).getTime() < now,
    ).length;

    const closedOps = (orders ?? []).filter((o) => o.status === "concluida");
    const closedOnTime = closedOps.filter(
      (o) =>
        !o.due_date ||
        new Date(o.stage_updated_at ?? o.created_at).getTime() <=
          new Date(o.due_date as string).getTime(),
    ).length;
    const onTimePct = closedOps.length > 0 ? (closedOnTime / closedOps.length) * 100 : null;

    // ── Reservas: buscar por OPs abertas do produto
    const openIds = openOps.map((o) => o.id);
    let resRows: Array<{
      status: string;
      qty_required: number | null;
      qty_reserved: number | null;
      qty_consumed: number | null;
    }> = [];
    if (openIds.length > 0) {
      const { data: r } = await supabase
        .from("material_reservations")
        .select("status, qty_required, qty_reserved, qty_consumed")
        .in("production_order_id", openIds);
      resRows = (r ?? []) as typeof resRows;
    }
    void reservations; // placeholder query descartado

    const active = resRows.filter((r) => r.status === "ativa").length;
    const shortage = resRows.filter(
      (r) => Number(r.qty_reserved ?? 0) < Number(r.qty_required ?? 0),
    ).length;
    const totalReq = resRows.reduce((s, r) => s + Number(r.qty_required ?? 0), 0);
    const totalRes = resRows.reduce((s, r) => s + Number(r.qty_reserved ?? 0), 0);
    const coverage = totalReq > 0 ? Math.min(100, (totalRes / totalReq) * 100) : null;

    // ── Dwell por etapa: agrupa OPs abertas por stage e calcula dias parados
    const routingMap = new Map<string, number>();
    (routing ?? []).forEach((r) => routingMap.set(r.stage_key as string, r.sla_days as number));

    const byStage = new Map<string, { qty: number; dwellDays: number[]; orders: number }>();
    openOps.forEach((o) => {
      const key = String(o.stage ?? "compras");
      const entry = byStage.get(key) ?? { qty: 0, dwellDays: [], orders: 0 };
      entry.qty += Number(o.quantity ?? 0);
      entry.orders += 1;
      const ref = o.stage_updated_at ?? o.created_at;
      if (ref) {
        entry.dwellDays.push((now - new Date(ref).getTime()) / 86400000);
      }
      byStage.set(key, entry);
    });

    const stages: StageHealth[] = (stagesCfg ?? []).map((s) => {
      const e = byStage.get(s.key as string);
      const avgDwell =
        e && e.dwellDays.length > 0
          ? e.dwellDays.reduce((a, b) => a + b, 0) / e.dwellDays.length
          : null;
      const sla = routingMap.get(s.key as string) ?? null;
      return {
        stage_key: s.key as string,
        stage_label: s.label as string,
        wip_orders: e?.orders ?? 0,
        wip_qty: e?.qty ?? 0,
        avg_dwell_days: avgDwell != null ? Number(avgDwell.toFixed(1)) : null,
        sla_days: sla,
        breach: !!(avgDwell != null && sla != null && avgDwell > sla),
      };
    });

    // ── Gargalo: etapa com maior WIP e/ou maior estouro de SLA
    let bottleneck: ProductPcpHealth["bottleneck"] = null;
    const active_stages = stages.filter((s) => s.wip_orders > 0);
    if (active_stages.length > 0) {
      const scored = active_stages
        .map((s) => ({
          s,
          score:
            s.wip_orders * 2 +
            (s.breach && s.sla_days ? (s.avg_dwell_days! - s.sla_days) * 3 : 0),
        }))
        .sort((a, b) => b.score - a.score);
      const top = scored[0].s;
      bottleneck = {
        stage_key: top.stage_key,
        stage_label: top.stage_label,
        reason: top.breach
          ? `Dwell médio ${top.avg_dwell_days}d supera SLA ${top.sla_days}d com ${top.wip_orders} OP(s) paradas.`
          : `${top.wip_orders} OP(s) concentradas — maior WIP do produto.`,
      };
    }

    // ── Ocorrências recentes (últimos 30d) para contexto de qualidade
    let recent = 0;
    if (openIds.length > 0 || (orders?.length ?? 0) > 0) {
      const ids = (orders ?? []).map((o) => o.id);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { count } = await supabase
        .from("production_occurrences")
        .select("id", { count: "exact", head: true })
        .in("production_order_id", ids)
        .gte("created_at", since);
      recent = count ?? 0;
    }

    // ── Foco recomendado
    let focus = "Produção deste produto está estável.";
    if (shortage > 0) {
      focus = `Priorizar compra: ${shortage} material(is) com reserva incompleta.`;
    } else if (bottleneck && bottleneck.reason.includes("SLA")) {
      focus = `Desafogar ${bottleneck.stage_label}: SLA estourado, risco de atraso em cascata.`;
    } else if (lateOps > 0) {
      focus = `${lateOps} OP(s) já em atraso — revisar sequenciamento.`;
    } else if (bottleneck) {
      focus = `Balancear ${bottleneck.stage_label}: maior concentração de WIP.`;
    } else if (recent >= 3) {
      focus = `${recent} ocorrências nos últimos 30d — abrir análise de causa raiz.`;
    }

    return {
      product_id: productId,
      open_orders: openOrders,
      open_qty: openQty,
      late_orders: lateOps,
      on_time_pct: onTimePct != null ? Number(onTimePct.toFixed(1)) : null,
      bottleneck,
      stages: stages.filter((s) => s.wip_orders > 0 || s.sla_days != null),
      reservations: {
        total: resRows.length,
        active,
        shortage_items: shortage,
        coverage_pct: coverage != null ? Number(coverage.toFixed(1)) : null,
      },
      recent_occurrences: recent,
      focus,
    };
  });
