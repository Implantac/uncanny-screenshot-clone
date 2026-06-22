import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiReason } from "@/lib/ai-reason";

export type StageCapacity = {
  key: string;
  label: string;
  color: string | null;
  position: number;
  wipOrders: number;
  wipPieces: number;
  throughputPerDay: number; // peças/dia observadas últimos 14 dias
  demandNext4w: number; // peças com due_date nos próximos 28 dias passando por esta etapa
  coverageDays: number; // dias para drenar WIP + demanda no ritmo atual
  utilizationPct: number; // demanda/(throughput*28)
  status: "ok" | "alerta" | "gargalo";
  reason: string;
};

export type CapacityTocReport = {
  stages: StageCapacity[];
  bottleneck: StageCapacity | null;
  summary: {
    activeStages: number;
    bottlenecks: number;
    totalWipPieces: number;
    pipelineHealthPct: number; // % etapas ok
  };
  insight: string;
};

const STAGE_ORDER = ["cad", "modelagem", "corte", "costura", "acabamento", "qualidade", "expedicao"];

export const getCapacityTocReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CapacityTocReport> => {
    const { supabase, userId } = context;
    const now = new Date();
    const since14 = new Date(now.getTime() - 14 * 86400_000).toISOString();
    const horizon = new Date(now.getTime() + 28 * 86400_000);

    const [{ data: stages }, { data: orders }, { data: logs }] = await Promise.all([
      supabase
        .from("pcp_stages")
        .select("key, label, color, position, active")
        .eq("owner_id", userId)
        .eq("active", true)
        .order("position", { ascending: true }),
      supabase
        .from("production_orders")
        .select("id, quantity, progress, stage, status, due_date")
        .eq("owner_id", userId)
        .neq("status", "cancelada")
        .neq("status", "concluida"),
      supabase
        .from("production_stage_log")
        .select("to_stage, quantity, created_at")
        .eq("owner_id", userId)
        .gte("created_at", since14),
    ]);

    const stageList =
      (stages ?? []).length > 0
        ? (stages as any[]).map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            position: s.position,
          }))
        : STAGE_ORDER.map((k, i) => ({
            key: k,
            label: k[0].toUpperCase() + k.slice(1),
            color: null,
            position: i + 1,
          }));

    // throughput peças/dia por to_stage
    const tput = new Map<string, number>();
    (logs ?? []).forEach((l: any) => {
      if (!l.to_stage) return;
      tput.set(l.to_stage, (tput.get(l.to_stage) ?? 0) + Number(l.quantity ?? 0));
    });

    // WIP atual e demanda
    const wipOrders = new Map<string, number>();
    const wipPieces = new Map<string, number>();
    const demand = new Map<string, number>();

    for (const o of orders ?? []) {
      const stage = o.stage ?? "cad";
      const remaining = Math.max(
        0,
        Number(o.quantity ?? 0) - Number(o.progress ?? 0),
      );
      wipOrders.set(stage, (wipOrders.get(stage) ?? 0) + 1);
      wipPieces.set(stage, (wipPieces.get(stage) ?? 0) + remaining);

      if (!o.due_date) continue;
      const dd = new Date(o.due_date);
      if (dd > horizon) continue;
      // toda etapa do stage atual até expedicao precisa processar essas peças
      const idx = stageList.findIndex((s) => s.key === stage);
      const startIdx = idx === -1 ? 0 : idx;
      for (let i = startIdx; i < stageList.length; i++) {
        const k = stageList[i].key;
        demand.set(k, (demand.get(k) ?? 0) + remaining);
      }
    }

    const result: StageCapacity[] = stageList.map((s) => {
      const through = (tput.get(s.key) ?? 0) / 14; // peças/dia
      const wipP = wipPieces.get(s.key) ?? 0;
      const dem = demand.get(s.key) ?? 0;
      const dailyCapacity = through > 0 ? through : 0;
      const coverageDays = dailyCapacity > 0 ? (wipP + dem) / dailyCapacity : dem + wipP > 0 ? 999 : 0;
      const utilization = dailyCapacity > 0 ? (dem / (dailyCapacity * 28)) * 100 : dem > 0 ? 200 : 0;

      let status: StageCapacity["status"] = "ok";
      let reason = "Capacidade saudável para a demanda das próximas 4 semanas.";
      if (dailyCapacity === 0 && (wipP > 0 || dem > 0)) {
        status = "gargalo";
        reason = `Sem throughput observado nos últimos 14 dias com ${wipP + dem} peças aguardando.`;
      } else if (utilization >= 100 || coverageDays > 28) {
        status = "gargalo";
        reason = `Demanda excede capacidade (${utilization.toFixed(0)}% · ${coverageDays.toFixed(0)} dias para drenar).`;
      } else if (utilization >= 75 || coverageDays > 18) {
        status = "alerta";
        reason = `Utilização alta (${utilization.toFixed(0)}%). Sem folga para imprevistos.`;
      }

      return {
        key: s.key,
        label: s.label,
        color: s.color,
        position: s.position,
        wipOrders: wipOrders.get(s.key) ?? 0,
        wipPieces: wipP,
        throughputPerDay: Math.round(dailyCapacity * 10) / 10,
        demandNext4w: dem,
        coverageDays: Math.round(coverageDays),
        utilizationPct: Math.round(utilization),
        status,
        reason,
      };
    });

    const active = result.filter((r) => r.wipOrders + r.demandNext4w > 0);
    const bottleneck =
      active
        .filter((r) => r.status === "gargalo")
        .sort((a, b) => b.utilizationPct - a.utilizationPct)[0] ?? null;

    const bottleneckCount = active.filter((r) => r.status === "gargalo").length;
    const totalWipPieces = result.reduce((s, r) => s + r.wipPieces, 0);
    const okCount = active.filter((r) => r.status === "ok").length;
    const pipelineHealthPct = active.length ? (okCount / active.length) * 100 : 100;

    const insight = bottleneck
      ? `🚨 ${bottleneck.label} é o gargalo da operação: ${bottleneck.utilizationPct}% de utilização com ${bottleneck.coverageDays} dias para drenar. Toda peça liberada antes dele só engorda a fila — segure liberações em etapas anteriores até esta drenar.`
      : active.find((r) => r.status === "alerta")
        ? `⚠️ ${active.find((r) => r.status === "alerta")!.label} está em utilização alta. Sem ação não vira gargalo, mas qualquer imprevisto compromete prazos.`
        : "✅ Pipeline sem gargalo. Pode aceitar novos pedidos no ritmo atual.";

    return {
      stages: result,
      bottleneck,
      summary: {
        activeStages: active.length,
        bottlenecks: bottleneckCount,
        totalWipPieces,
        pipelineHealthPct,
      },
      insight,
    };
  });
