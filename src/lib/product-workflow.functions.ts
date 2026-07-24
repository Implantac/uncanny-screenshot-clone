import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const WORKFLOW_STEPS = [
  "concepcao",
  "modelagem",
  "engenharia",
  "custos",
  "piloto",
  "aprov_comercial",
  "aprov_diretoria",
  "liberacao_pcp",
  "producao",
] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export const STEP_META: Record<WorkflowStep, { label: string; icon: string; role: string }> = {
  concepcao:       { label: "Concepção",             icon: "Sparkles",     role: "Designer" },
  modelagem:       { label: "Modelagem",             icon: "PenTool",      role: "Modelista" },
  engenharia:      { label: "Engenharia / Ficha",    icon: "FileText",     role: "Engenharia" },
  custos:          { label: "Custos & Fornecedor",   icon: "DollarSign",   role: "Compras" },
  piloto:          { label: "Pilotagem",             icon: "Scissors",     role: "Piloto" },
  aprov_comercial: { label: "Aprovação Comercial",   icon: "ShoppingBag",  role: "Comercial" },
  aprov_diretoria: { label: "Aprovação Diretoria",   icon: "Crown",        role: "Diretoria" },
  liberacao_pcp:   { label: "Liberação PCP",         icon: "ShieldCheck",  role: "PCP" },
  producao:        { label: "Produção",              icon: "Factory",      role: "PCP" },
};

export type WorkflowRow = {
  id: string;
  product_id: string;
  step: WorkflowStep;
  step_order: number;
  owner_role: string | null;
  assignee_id: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "bloqueado";
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  blocker_reason: string | null;
  notes: string | null;
  updated_at: string;
};

export const listProductWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string }) =>
    z.object({ productId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<WorkflowRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("product_workflow_steps")
      .select(
        "id, product_id, step, step_order, owner_role, assignee_id, status, started_at, completed_at, completed_by, blocker_reason, notes, updated_at",
      )
      .eq("product_id", data.productId)
      .order("step_order", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      // lazy seed
      await context.supabase.rpc("product_workflow_seed", {
        _product_id: data.productId,
      });
      const { data: rows2 } = await context.supabase
        .from("product_workflow_steps")
        .select(
          "id, product_id, step, step_order, owner_role, assignee_id, status, started_at, completed_at, completed_by, blocker_reason, notes, updated_at",
        )
        .eq("product_id", data.productId)
        .order("step_order", { ascending: true });
      return (rows2 ?? []) as WorkflowRow[];
    }
    return rows as WorkflowRow[];
  });

export const advanceProductWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string; note?: string | null }) =>
    z
      .object({
        productId: z.string().uuid(),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc(
      "product_workflow_advance",
      { _product_id: data.productId, _note: data.note ?? null },
    );
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return row as {
      advanced: boolean;
      from_step: string | null;
      to_step: string | null;
      blockers: string[];
    };
  });

export type MyWorkflowTask = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  step: WorkflowStep;
  step_order: number;
  status: "em_andamento" | "bloqueado";
  owner_role: string | null;
  started_at: string | null;
  blocker_reason: string | null;
  updated_at: string;
};

export const listMyWorkflowTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyWorkflowTask[]> => {
    const { data, error } = await context.supabase
      .from("v_my_workflow_tasks")
      .select(
        "id, product_id, product_name, product_sku, product_image, step, step_order, status, owner_role, started_at, blocker_reason, updated_at",
      )
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MyWorkflowTask[];
  });
