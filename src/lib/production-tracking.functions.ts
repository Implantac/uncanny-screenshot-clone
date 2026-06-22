import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Mapping coluna do Acompanhamento → (stage, outsourced?, progress?)
const COL_MAP: Record<
  string,
  { stage: string; outsourced?: boolean; progress?: "zero" | "started" | "almost" | "full" }
> = {
  aguardando_corte: { stage: "cad" },
  em_corte: { stage: "corte" },
  aguardando_costura: { stage: "costura", progress: "zero" },
  costura_interna: { stage: "costura", outsourced: false, progress: "started" },
  costura_externa: { stage: "costura", outsourced: true, progress: "started" },
  aguardando_acabamento: { stage: "acabamento", progress: "zero" },
  acabamento_interno: { stage: "acabamento", outsourced: false, progress: "started" },
  acabamento_externo: { stage: "acabamento", outsourced: true, progress: "started" },
  revisao: { stage: "qualidade" },
  embalagem: { stage: "expedicao", progress: "almost" },
  expedicao: { stage: "expedicao", progress: "full" },
  finalizado: { stage: "entregue", progress: "full" },
};

const Input = z.object({
  orderId: z.string().uuid(),
  toColumn: z.string().min(1),
  note: z.string().max(500).optional(),
  overrideReason: z.string().max(500).optional(),
});

export const moveOrderToColumn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = COL_MAP[data.toColumn];
    if (!target) throw new Error(`Coluna inválida: ${data.toColumn}`);

    const { data: cur, error: e0 } = await supabase
      .from("production_orders")
      .select("id, owner_id, stage, outsourced, progress, quantity")
      .eq("id", data.orderId)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!cur || cur.owner_id !== userId) throw new Error("OP não encontrada.");

    // -------- Gates obrigatórios por etapa --------
    const { evaluateStageGates } = await import("@/lib/pcp-gates.functions");
    const evalRes = await evaluateStageGates({
      data: { orderId: data.orderId, toStage: target.stage },
    });
    const failed = evalRes.checks.filter((c) => c.blocking && c.status === "fail");
    if (failed.length > 0 && !data.overrideReason) {
      const labels = failed.map((f) => f.label).join(", ");
      const err = new Error(`Gates bloquearam o avanço para ${target.stage}: ${labels}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "STAGE_GATE_BLOCKED";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).gateChecks = evalRes.checks;
      throw err;
    }

    const update: Record<string, unknown> = { stage: target.stage };
    if (typeof target.outsourced === "boolean") update.outsourced = target.outsourced;
    if (target.progress === "zero") update.progress = 0;
    else if (target.progress === "started")
      update.progress = Math.max(1, Number(cur.progress ?? 0));
    else if (target.progress === "almost")
      update.progress = Math.min(99, Math.max(1, Number(cur.progress ?? 0)));
    else if (target.progress === "full") update.progress = 100;

    if (target.stage === "entregue") update.status = "concluida";

    const { error } = await supabase
      .from("production_orders")
      .update(update as never)
      .eq("id", data.orderId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);

    if (data.note || data.overrideReason) {
      await supabase.from("production_stage_log").insert({
        order_id: data.orderId,
        owner_id: userId,
        from_stage: cur.stage,
        to_stage: target.stage,
        note: data.overrideReason
          ? `⚠️ OVERRIDE: ${data.overrideReason}${data.note ? ` — ${data.note}` : ""}`
          : (data.note ?? null),
      } as never);
    }
    if (data.overrideReason) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("audit_logs").insert({
        user_id: userId,
        action: "pcp.stage_gate_override",
        entity: "production_order",
        entity_id: data.orderId,
        payload: {
          to_stage: target.stage,
          reason: data.overrideReason,
          failed_checks: failed.map((f) => f.key),
        },
      });
    }

    return {
      ok: true,
      warnings: evalRes.checks.filter((c) => c.status === "warn"),
    };
  });
