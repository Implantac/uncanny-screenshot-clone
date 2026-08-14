import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORKFLOW_STEPS, type WorkflowStep } from "./product-workflow.functions";

export type DevFlowStepStat = {
  step: WorkflowStep;
  order: number;
  active: number;
  blocked: number;
  done: number;
};

export type DevFlowStats = {
  total_products: number;
  in_flow: number;
  blocked: number;
  concluded: number;
  steps: DevFlowStepStat[];
};

/**
 * Agrega contagem de produtos por etapa do fluxo de desenvolvimento.
 * Usa `product_workflow_steps` respeitando RLS do usuário.
 */
export const getDevelopmentFlowStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DevFlowStats> => {
    const { data, error } = await context.supabase
      .from("product_workflow_steps")
      .select("product_id, step, status");
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      product_id: string;
      step: WorkflowStep;
      status: "pendente" | "em_andamento" | "concluido" | "bloqueado";
    }>;

    const byStep = new Map<WorkflowStep, DevFlowStepStat>();
    WORKFLOW_STEPS.forEach((s, i) => {
      byStep.set(s, { step: s, order: i + 1, active: 0, blocked: 0, done: 0 });
    });

    // "Etapa atual" de cada produto = primeira não concluída (ou última se todas concluídas)
    const byProduct = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byProduct.get(r.product_id) ?? [];
      arr.push(r);
      byProduct.set(r.product_id, arr);
    }

    let blocked = 0;
    let concluded = 0;
    let inFlow = 0;

    for (const [, stepsArr] of byProduct) {
      const ordered = [...stepsArr].sort(
        (a, b) => WORKFLOW_STEPS.indexOf(a.step) - WORKFLOW_STEPS.indexOf(b.step),
      );
      const current = ordered.find((s) => s.status !== "concluido") ?? ordered[ordered.length - 1];
      if (!current) continue;
      const bucket = byStep.get(current.step);
      if (!bucket) continue;
      if (current.status === "bloqueado") {
        bucket.blocked += 1;
        blocked += 1;
        inFlow += 1;
      } else if (current.status === "concluido") {
        bucket.done += 1;
        concluded += 1;
      } else {
        bucket.active += 1;
        inFlow += 1;
      }
    }

    return {
      total_products: byProduct.size,
      in_flow: inFlow,
      blocked,
      concluded,
      steps: Array.from(byStep.values()),
    };
  });
