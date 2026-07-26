import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORKFLOW_STEPS, type WorkflowStep } from "./product-workflow.functions";

export type LifecycleKanbanCard = {
  product_id: string;
  sku: string;
  name: string;
  image_url: string | null;
  collection_id: string | null;
  collection_name: string | null;
  current_step: WorkflowStep;
  current_status: "pendente" | "em_andamento" | "concluido" | "bloqueado";
  started_at: string | null;
  updated_at: string;
  days_in_step: number;
  blocked: boolean;
  blocker_reason: string | null;
};

export type LifecycleKanbanColumn = {
  step: WorkflowStep;
  cards: LifecycleKanbanCard[];
};

export const listLifecycleKanban = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LifecycleKanbanColumn[]> => {
    // 1) products the user owns
    const { data: products, error: pErr } = await context.supabase
      .from("products")
      .select("id, sku, name, image_url, collection_id, collections(name)")
      .order("updated_at", { ascending: false })
      .limit(400);
    if (pErr) throw new Error(pErr.message);
    const productIds = (products ?? []).map((p) => p.id);
    if (productIds.length === 0) {
      return WORKFLOW_STEPS.map((step) => ({ step, cards: [] }));
    }

    // 2) all workflow steps for those products
    const { data: steps, error: sErr } = await context.supabase
      .from("product_workflow_steps")
      .select("product_id, step, step_order, status, started_at, updated_at, blocker_reason")
      .in("product_id", productIds)
      .order("step_order", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    // 3) compute current step per product:
    //    prefer bloqueado > em_andamento > next pendente > last concluido
    const byProduct = new Map<string, typeof steps>();
    for (const s of steps ?? []) {
      const arr = byProduct.get(s.product_id) ?? [];
      arr.push(s);
      byProduct.set(s.product_id, arr);
    }

    const now = Date.now();
    const cardsByStep = new Map<WorkflowStep, LifecycleKanbanCard[]>();
    WORKFLOW_STEPS.forEach((st) => cardsByStep.set(st, []));

    for (const p of products ?? []) {
      const list = (byProduct.get(p.id) ?? []).slice().sort(
        (a, b) => a.step_order - b.step_order,
      );
      if (list.length === 0) continue;

      const blocked = list.find((s) => s.status === "bloqueado");
      const inProgress = list.find((s) => s.status === "em_andamento");
      const firstPending = list.find((s) => s.status === "pendente");
      const lastDone = [...list].reverse().find((s) => s.status === "concluido");
      const chosen = blocked ?? inProgress ?? firstPending ?? lastDone ?? list[0];
      if (!chosen) continue;

      const anchor = chosen.started_at ?? chosen.updated_at;
      const daysInStep = anchor
        ? Math.max(0, Math.floor((now - new Date(anchor).getTime()) / 86400000))
        : 0;

      const collectionName =
        (p as unknown as { collections: { name: string } | null }).collections?.name ?? null;

      cardsByStep.get(chosen.step as WorkflowStep)!.push({
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        image_url: p.image_url ?? null,
        collection_id: p.collection_id ?? null,
        collection_name: collectionName,
        current_step: chosen.step as WorkflowStep,
        current_status: chosen.status,
        started_at: chosen.started_at,
        updated_at: chosen.updated_at,
        days_in_step: daysInStep,
        blocked: chosen.status === "bloqueado",
        blocker_reason: chosen.blocker_reason ?? null,
      });
    }

    return WORKFLOW_STEPS.map((step) => ({
      step,
      cards: (cardsByStep.get(step) ?? []).sort(
        (a, b) => (b.blocked ? 1 : 0) - (a.blocked ? 1 : 0) || b.days_in_step - a.days_in_step,
      ),
    }));
  });
