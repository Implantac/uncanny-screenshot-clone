import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Etapas padrão do fluxo de aprovação da ficha técnica. */
export const APPROVAL_STAGES = [
  { stage: 1, role: "estilo", label: "Estilo" },
  { stage: 2, role: "modelagem", label: "Modelagem" },
  { stage: 3, role: "compras", label: "Compras" },
  { stage: 4, role: "custos", label: "Custos" },
  { stage: 5, role: "qualidade", label: "Qualidade" },
  { stage: 6, role: "diretoria", label: "Diretoria" },
  { stage: 7, role: "producao", label: "Liberação para produção" },
] as const;

export type ApprovalStatus =
  | "pendente"
  | "em_analise"
  | "aprovado"
  | "reprovado"
  | "pulado"
  | "cancelado";

export type ApprovalRow = {
  id: string;
  owner_id: string;
  product_id: string | null;
  tech_sheet_id: string;
  stage: number;
  role: string;
  assigned_to: string | null;
  status: ApprovalStatus;
  sent_at: string | null;
  decided_at: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Lista o fluxo de aprovação de uma ficha técnica.
 * Se ainda não existir, inicializa as 7 etapas padrão.
 */
export const listApprovalWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ techSheetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sheet } = await supabase
      .from("tech_sheets")
      .select("id, owner_id")
      .eq("id", data.techSheetId)
      .maybeSingle();
    if (!sheet) throw new Error("Ficha não encontrada.");

    await supabase.rpc("ensure_approval_workflow", {
      _tech_sheet_id: data.techSheetId,
    });

    const { data, error } = await supabase
      .from("approval_workflow")
      .select("*")
      .eq("tech_sheet_id", data.techSheetId)
      .order("stage");
    if (error) throw new Error(error.message);

    return (data ?? []) as ApprovalRow[];
  });

/**
 * Envia o fluxo para a próxima etapa (atribui responsável e marca 'em_analise').
 * Se nenhuma stage for informada, envia a primeira pendente.
 */
export const sendApprovalWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        techSheetId: z.string().uuid(),
        stage: z.number().int().min(1).max(7).optional(),
        assignedTo: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sheet } = await supabase
      .from("tech_sheets")
      .select("id, owner_id")
      .eq("id", data.techSheetId)
      .maybeSingle();
    if (!sheet) throw new Error("Ficha não encontrada.");
    if (sheet.owner_id !== userId) {
      throw new Error("Apenas o responsável pela ficha pode enviar para aprovação.");
    }

    await supabase.rpc("ensure_approval_workflow", {
      _tech_sheet_id: data.techSheetId,
    });

    let stage = data.stage;
    if (!stage) {
      const { data: firstPending } = await supabase
        .from("approval_workflow")
        .select("stage")
        .eq("tech_sheet_id", data.techSheetId)
        .eq("status", "pendente")
        .order("stage")
        .limit(1)
        .maybeSingle();
      stage = (firstPending?.stage as number) ?? 1;
    }

    const patch: Record<string, unknown> = {
      status: "em_analise",
      sent_at: new Date().toISOString(),
    };
    if (data.assignedTo) patch.assigned_to = data.assignedTo;

    const { error } = await supabase
      .from("approval_workflow")
      .update(patch)
      .eq("tech_sheet_id", data.techSheetId)
      .eq("stage", stage);
    if (error) throw new Error(error.message);

    return { ok: true, stage };
  });

type Decision = "aprovado" | "reprovado" | "pulado" | "cancelado";

const DECISION_SCHEMA = z.object({
  techSheetId: z.string().uuid(),
  stage: z.number().int().min(1).max(7),
  decision: z.enum(["aprovado", "reprovado", "pulado", "cancelado"]),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * Decide uma etapa do fluxo. Aprovação de todas as etapas → ficha aprovada.
 * Reprovação → ficha volta para em_revisao (destravada para nova versão).
 * Comentário é obrigatório em reprovação.
 */
async function decide(context: { supabase: any; userId: string }, data: {
  techSheetId: string;
  stage: number;
  decision: Decision;
  comment?: string;
}) {
  const { supabase, userId } = context;

  if (data.decision === "reprovado" && !data.comment?.trim()) {
    throw new Error("Justificativa obrigatória para reprovar.");
  }

  const { data: step } = await supabase
    .from("approval_workflow")
    .select("id, status, assigned_to")
    .eq("tech_sheet_id", data.techSheetId)
    .eq("stage", data.stage)
    .maybeSingle();
  if (!step) throw new Error("Etapa não encontrada.");

  const canDecide =
    step.status === "em_analise" &&
    (step.assigned_to === userId || (step.assigned_to === null && step.status === "em_analise"));
  if (!canDecide) {
    throw new Error("Esta etapa não está aguardando a sua decisão.");
  }

  const { error } = await supabase
    .from("approval_workflow")
    .update({
      status: data.decision,
      decided_at: new Date().toISOString(),
      comment: data.comment ?? null,
    })
    .eq("id", step.id);
  if (error) throw new Error(error.message);

  return { ok: true, stage: data.stage, decision: data.decision };
}

export const decideApprovalWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DECISION_SCHEMA.parse(d))
  .handler(async ({ data, context }) => decide(context, data));

/** Pula uma etapa (sem afetar o status da ficha). */
export const skipApprovalWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        techSheetId: z.string().uuid(),
        stage: z.number().int().min(1).max(7),
        comment: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    decide(context, { ...data, decision: "pulado" }),
  );

/** Cancela uma etapa. */
export const cancelApprovalWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        techSheetId: z.string().uuid(),
        stage: z.number().int().min(1).max(7),
        comment: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    decide(context, { ...data, decision: "cancelado" }),
  );

/** Redefine o fluxo (etapas pendentes/em análise voltam ao início). */
export const resetApprovalWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ techSheetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sheet } = await supabase
      .from("tech_sheets")
      .select("id, owner_id")
      .eq("id", data.techSheetId)
      .maybeSingle();
    if (!sheet) throw new Error("Ficha não encontrada.");
    if (sheet.owner_id !== userId) {
      throw new Error("Apenas o responsável pela ficha pode redefinir o fluxo.");
    }
    const { error } = await supabase.rpc("reset_approval_workflow", {
      _tech_sheet_id: data.techSheetId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
