/**
 * PCP — Gates obrigatórios por etapa.
 *
 * Avalia pré-condições antes de avançar uma OP. Cada check tem:
 *  - status: pass | warn | fail
 *  - blocking: true se reprovar impede o avanço (override de supervisor obrigatório)
 *
 * `moveOrderToColumn` chama `evaluateStageGates` automaticamente; se houver
 * qualquer check `fail + blocking` e nenhum `overrideReason` for fornecido,
 * a movimentação é abortada e a UI exibe a justificativa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GateStatus = "pass" | "warn" | "fail";
export type GateCheck = {
  key: string;
  label: string;
  status: GateStatus;
  message: string;
  blocking: boolean;
  reason: string; // explicabilidade (porque esse gate existe)
};

export type GateEvaluation = {
  orderId: string;
  toStage: string;
  checks: GateCheck[];
  canAdvance: boolean; // true se nenhum bloqueante falhou
  hasWarnings: boolean;
};

// Coluna do kanban → stage real (subset; alinhado a production-tracking)
const COL_TO_STAGE: Record<string, string> = {
  aguardando_corte: "cad",
  em_corte: "corte",
  aguardando_costura: "costura",
  costura_interna: "costura",
  costura_externa: "costura",
  aguardando_acabamento: "acabamento",
  acabamento_interno: "acabamento",
  acabamento_externo: "acabamento",
  revisao: "qualidade",
  embalagem: "expedicao",
  expedicao: "expedicao",
  finalizado: "entregue",
};

export function columnToStage(col: string): string | null {
  return COL_TO_STAGE[col] ?? null;
}

const Input = z.object({
  orderId: z.string().uuid(),
  toStage: z.string().min(1),
});

export const evaluateStageGates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<GateEvaluation> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: order } = await sb
      .from("production_orders")
      .select("id, owner_id, stage, product_id, progress, quantity")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.owner_id !== context.userId) {
      throw new Error("OP não encontrada.");
    }

    const checks: GateCheck[] = [];
    const to = data.toStage;

    // -------- corte: ficha técnica aprovada
    if (to === "corte" || to === "cad") {
      if (!order.product_id) {
        checks.push({
          key: "tech_sheet_approved",
          label: "Ficha técnica aprovada",
          status: "warn",
          message: "OP sem produto vinculado — não há ficha para validar.",
          blocking: false,
          reason:
            "Corte exige ficha aprovada para garantir consumo correto de tecido e modelagem revisada.",
        });
      } else {
        const { data: ts } = await sb
          .from("tech_sheets")
          .select("id, status")
          .eq("product_id", order.product_id)
          .eq("status", "aprovada")
          .limit(1)
          .maybeSingle();
        checks.push({
          key: "tech_sheet_approved",
          label: "Ficha técnica aprovada",
          status: ts ? "pass" : "fail",
          message: ts
            ? "Ficha aprovada encontrada."
            : "Nenhuma ficha aprovada para o produto.",
          blocking: true,
          reason:
            "Corte sem ficha aprovada gera retrabalho e desperdício de tecido.",
        });
      }
    }

    // -------- costura: estágio anterior concluído + sem ocorrência crítica aberta
    if (to === "costura") {
      const cutOk = ["corte", "costura", "acabamento", "qualidade", "expedicao", "entregue"].includes(
        order.stage,
      );
      checks.push({
        key: "cut_done",
        label: "Corte concluído",
        status: cutOk ? "pass" : "fail",
        message: cutOk
          ? "OP já passou pelo corte."
          : `Estágio atual: ${order.stage}. Conclua o corte primeiro.`,
        blocking: true,
        reason: "Costura sem corte concluído indica peças faltando ou ordem invertida.",
      });
    }

    // -------- acabamento e adiante: sem ocorrência crítica aberta
    if (["acabamento", "qualidade", "expedicao", "entregue"].includes(to)) {
      const { data: occ } = await sb
        .from("production_occurrences")
        .select("id, kind, status")
        .eq("order_id", data.orderId)
        .eq("status", "aberta");
      const critical = (occ ?? []).filter((o: { kind: string }) =>
        /critic|grave|bloqueante/i.test(o.kind),
      );
      checks.push({
        key: "no_critical_open_occurrence",
        label: "Sem ocorrência crítica aberta",
        status: critical.length ? "fail" : (occ?.length ?? 0) > 0 ? "warn" : "pass",
        message: critical.length
          ? `${critical.length} ocorrência(s) crítica(s) abertas.`
          : occ?.length
            ? `${occ.length} ocorrência(s) aberta(s) não-crítica(s).`
            : "Nenhuma ocorrência em aberto.",
        blocking: critical.length > 0,
        reason:
          "Avançar com defeito crítico em aberto propaga o problema para o próximo setor e quebra rastreabilidade.",
      });
    }

    // -------- qualidade: inspeção registrada com resultado
    if (to === "qualidade" || to === "expedicao" || to === "entregue") {
      const { data: insp } = await sb
        .from("quality_inspections")
        .select("id, result, inspected_at")
        .eq("production_order_id", data.orderId)
        .order("inspected_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (to === "qualidade") {
        // entrar em qualidade exige que o setor anterior tenha apontado >= 50%
        checks.push({
          key: "min_progress_for_qa",
          label: "Apontamento mínimo (≥ 50%)",
          status: (order.progress ?? 0) >= 50 ? "pass" : "warn",
          message: `Apontamento atual: ${order.progress ?? 0}%.`,
          blocking: false,
          reason:
            "Qualidade revisa peças finalizadas — entrar com pouco apontamento gera inspeção desconexa.",
        });
      }
      if (to === "expedicao" || to === "entregue") {
        const approved = insp?.result === "approved" || insp?.result === "aprovada";
        checks.push({
          key: "qa_approved",
          label: "Inspeção de qualidade aprovada",
          status: approved ? "pass" : insp ? "fail" : "fail",
          message: approved
            ? `Aprovado em ${new Date(insp!.inspected_at).toLocaleDateString("pt-BR")}.`
            : insp
              ? `Última inspeção: ${insp.result}. Necessário 'aprovada'.`
              : "Nenhuma inspeção de qualidade registrada para esta OP.",
          blocking: true,
          reason:
            "Expedir sem aprovação de qualidade libera peças não conformes ao cliente.",
        });
      }
    }

    // -------- entregue: 100% apontado
    if (to === "entregue") {
      checks.push({
        key: "full_progress",
        label: "Apontamento 100%",
        status: (order.progress ?? 0) >= 100 ? "pass" : "fail",
        message: `Apontamento atual: ${order.progress ?? 0}%.`,
        blocking: true,
        reason: "Encerrar uma OP com apontamento parcial distorce capacidade e custos reais.",
      });
    }

    const canAdvance = !checks.some((c) => c.blocking && c.status === "fail");
    const hasWarnings = checks.some((c) => c.status === "warn");

    return { orderId: data.orderId, toStage: to, checks, canAdvance, hasWarnings };
  });
