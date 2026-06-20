import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Stage =
  | "cad"
  | "corte"
  | "costura"
  | "acabamento"
  | "qualidade"
  | "expedicao"
  | "entregue"
  | "concluido";

const ORDER: Stage[] = [
  "cad",
  "corte",
  "costura",
  "acabamento",
  "qualidade",
  "expedicao",
  "entregue",
];

// Fallback médio (em horas) quando não há histórico suficiente
const FALLBACK_H: Record<Stage, number> = {
  cad: 24,
  corte: 16,
  costura: 72,
  acabamento: 24,
  qualidade: 12,
  expedicao: 8,
  entregue: 0,
  concluido: 0,
};

export type DelayPrediction = {
  orderId: string;
  code: string;
  productName: string | null;
  currentStage: Stage;
  dueDate: string | null;
  predictedDoneAt: string;
  predictedDelayHours: number;
  risk: "low" | "medium" | "high";
  reason: string;
};

export const predictDelays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ items: DelayPrediction[]; avgPerStage: Record<string, number> }> => {
      const sb = context.supabase;

      // 1) Histórico das últimas transições para calcular tempo médio por etapa
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: logs } = await sb
        .from("production_stage_log")
        .select("order_id, from_stage, to_stage, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);

      // tempo médio que uma OP ficou em from_stage antes de avançar
      const byOrder = new Map<string, Array<{ stage: Stage | null; at: number }>>();
      type LogRow = { order_id: string; to_stage: Stage | null; created_at: string };
      ((logs ?? []) as LogRow[]).forEach((l) => {
        const arr = byOrder.get(l.order_id) ?? [];
        arr.push({ stage: l.to_stage, at: new Date(l.created_at).getTime() });
        byOrder.set(l.order_id, arr);
      });

      const durations = new Map<Stage, number[]>();
      byOrder.forEach((arr) => {
        for (let i = 1; i < arr.length; i++) {
          const stage = arr[i - 1].stage as Stage | null;
          if (!stage) continue;
          const ms = arr[i].at - arr[i - 1].at;
          if (ms <= 0 || ms > 30 * 86400000) continue;
          const list = durations.get(stage) ?? [];
          list.push(ms / 36e5);
          durations.set(stage, list);
        }
      });

      const avgH: Record<Stage, number> = { ...FALLBACK_H };
      durations.forEach((list, stage) => {
        if (list.length >= 3) {
          const sorted = [...list].sort((a, b) => a - b);
          avgH[stage] = sorted[Math.floor(sorted.length / 2)]; // mediana
        }
      });

      // 2) OPs ativas
      const { data: orders } = await sb
        .from("production_orders")
        .select("id, code, stage, due_date, stage_updated_at, products(name)")
        .not("stage", "in", "(entregue,concluido)")
        .neq("status", "cancelada")
        .limit(500);

      const now = Date.now();
      type OrderRow = { id: string; code: string; stage: Stage; due_date: string | null; stage_updated_at: string | null; products: { name: string | null } | null };
      const items: DelayPrediction[] = ((orders ?? []) as OrderRow[]).map((o) => {
        const stage = o.stage as Stage;
        const idx = ORDER.indexOf(stage);
        const stageStart = o.stage_updated_at ? new Date(o.stage_updated_at).getTime() : now;
        const elapsedH = Math.max(0, (now - stageStart) / 36e5);
        // tempo restante na etapa atual
        const remainCurrent = Math.max(0, (avgH[stage] ?? 0) - elapsedH);
        // soma das etapas restantes
        const remainRest =
          idx >= 0
            ? ORDER.slice(idx + 1, ORDER.indexOf("entregue")).reduce(
                (s, st) => s + (avgH[st] ?? 0),
                0,
              )
            : 0;
        const totalRemainH = remainCurrent + remainRest;
        const predictedDoneAt = new Date(now + totalRemainH * 36e5).toISOString();

        let predictedDelayH = 0;
        if (o.due_date) {
          const due = new Date(o.due_date).getTime();
          predictedDelayH = Math.round((now + totalRemainH * 36e5 - due) / 36e5);
        }

        const risk: "low" | "medium" | "high" =
          predictedDelayH >= 48 ? "high" : predictedDelayH >= 8 ? "medium" : "low";

        const stuckH = Math.round(elapsedH);
        const reasonParts: string[] = [];
        if (stuckH > Math.round((avgH[stage] ?? 0) * 1.5)) {
          reasonParts.push(
            `parada há ${stuckH}h em ${stage} (média ${Math.round(avgH[stage] ?? 0)}h)`,
          );
        }
        if (idx >= 0 && idx < ORDER.indexOf("entregue") - 1) {
          reasonParts.push(`faltam ${Math.round(totalRemainH)}h estimadas até entrega`);
        }
        if (o.due_date) {
          reasonParts.push(
            predictedDelayH > 0
              ? `previsão ${predictedDelayH}h após o prazo`
              : `dentro do prazo (${Math.abs(predictedDelayH)}h de folga)`,
          );
        }

        return {
          orderId: o.id,
          code: o.code,
          productName: o.products?.name ?? null,
          currentStage: stage,
          dueDate: o.due_date,
          predictedDoneAt,
          predictedDelayHours: predictedDelayH,
          risk,
          reason: reasonParts.join(" · "),
        };
      });

      // ordena por risco/atraso desc
      items.sort((a, b) => b.predictedDelayHours - a.predictedDelayHours);

      const avgPerStage: Record<string, number> = {};
      (Object.keys(avgH) as Stage[]).forEach((s) => (avgPerStage[s] = Math.round(avgH[s])));

      return { items, avgPerStage };
    },
  );
