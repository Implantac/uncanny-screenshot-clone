import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExecutiveKpis = {
  development: {
    prototypesOpen: number;
    prototypesApproved30d: number;
    avgLeadDays: number;
  };
  production: {
    openOrders: number;
    delayedOrders: number;
    onTimePct: number;
  };
  quality: {
    inspections30d: number;
    rejectRate: number;
    openCapa: number;
  };
  cost: {
    avgGapPct: number;
    overruns: number;
  };
  marketing: {
    activeCampaigns: number;
    investment30d: number;
    avgRoas: number;
  };
  insights: string[];
};

export const getExecutiveKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExecutiveKpis> => {
    const { supabase, userId } = context;
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400_000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [protos, orders, insps, capa, costs, targets, camps] = await Promise.all([
      supabase.from("prototypes").select("id, stage, created_at, updated_at").eq("owner_id", userId),
      supabase.from("production_orders").select("id, status, due_date, stage_updated_at").eq("owner_id", userId),
      supabase.from("quality_inspections").select("id, result, created_at").eq("owner_id", userId).gte("created_at", d30),
      supabase.from("quality_capa").select("id, status").eq("owner_id", userId).eq("status", "aberta"),
      supabase.from("tech_sheets").select("product_id, cost_price, status").eq("owner_id", userId).eq("status", "aprovada"),
      supabase.from("product_target_costs").select("product_id, target_cost").eq("owner_id", userId),
      supabase.from("marketing_campaigns").select("status, investment, roas, start_date").eq("owner_id", userId),
    ]);

    // Development
    const allProtos = protos.data ?? [];
    const prototypesOpen = allProtos.filter((p: any) => p.stage !== "aprovado" && p.stage !== "rejeitado").length;
    const approved30 = allProtos.filter((p: any) => p.stage === "aprovado" && p.updated_at >= d30);
    const prototypesApproved30d = approved30.length;
    const leads = approved30
      .map((p: any) => (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / 86400_000)
      .filter((d) => d >= 0);
    const avgLeadDays = leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : 0;

    // Production
    const allOrders = orders.data ?? [];
    const openOrders = allOrders.filter((o: any) => o.status !== "concluida" && o.status !== "cancelada").length;
    const delayedOrders = allOrders.filter(
      (o: any) => o.due_date && o.due_date < today && o.status !== "concluida" && o.status !== "cancelada",
    ).length;
    const finishedDue = allOrders.filter((o: any) => o.status === "concluida" && o.due_date);
    const onTime = finishedDue.filter((o: any) => (o.stage_updated_at ?? "") <= o.due_date + "T23:59:59").length;
    const onTimePct = finishedDue.length ? (onTime / finishedDue.length) * 100 : 0;

    // Quality
    const allInsps = insps.data ?? [];
    const reproved = allInsps.filter((i: any) => i.result === "reprovado" || i.result === "reprovada").length;
    const rejectRate = allInsps.length ? (reproved / allInsps.length) * 100 : 0;

    // Cost
    const tgtMap = new Map<string, number>();
    (targets.data ?? []).forEach((t: any) => t.product_id && tgtMap.set(t.product_id, Number(t.target_cost)));
    const gaps: number[] = [];
    let overruns = 0;
    (costs.data ?? []).forEach((c: any) => {
      if (!c.product_id) return;
      const tgt = tgtMap.get(c.product_id);
      if (!tgt || tgt <= 0) return;
      const gap = ((Number(c.cost_price) - tgt) / tgt) * 100;
      gaps.push(gap);
      if (gap > 10) overruns++;
    });
    const avgGapPct = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

    // Marketing
    const allCamps = camps.data ?? [];
    const activeCampaigns = allCamps.filter((c: any) => c.status === "ativa").length;
    const c30 = allCamps.filter((c: any) => c.start_date && c.start_date >= d30.slice(0, 10));
    const investment30d = c30.reduce((a, b: any) => a + Number(b.investment ?? 0), 0);
    const roasVals = c30.map((c: any) => Number(c.roas ?? 0)).filter((r) => r > 0);
    const avgRoas = roasVals.length ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : 0;

    // Insights
    const insights: string[] = [];
    if (delayedOrders > 0) insights.push(`${delayedOrders} OPs atrasadas — priorizar PCP e fornecedores críticos`);
    if (rejectRate > 5) insights.push(`Reprovação em ${rejectRate.toFixed(1)}% — abrir CAPA por causa raiz`);
    if (overruns > 0) insights.push(`${overruns} produtos com custo >10% acima da meta — revisar BOM/MOD`);
    if (avgLeadDays > 30) insights.push(`Lead-time de protótipo em ${avgLeadDays.toFixed(0)}d — gargalo de modelagem`);
    if (avgRoas > 0 && avgRoas < 1.5) insights.push(`ROAS médio em ${avgRoas.toFixed(2)} — realocar verba para canais top`);
    if (insights.length === 0) insights.push("Operação no verde — manter cadência atual");

    return {
      development: { prototypesOpen, prototypesApproved30d, avgLeadDays },
      production: { openOrders, delayedOrders, onTimePct },
      quality: { inspections30d: allInsps.length, rejectRate, openCapa: (capa.data ?? []).length },
      cost: { avgGapPct, overruns },
      marketing: { activeCampaigns, investment30d, avgRoas },
      insights,
    };
  });
