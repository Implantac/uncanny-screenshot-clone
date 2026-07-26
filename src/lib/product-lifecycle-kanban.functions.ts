import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

export type LifecycleKanbanResult = {
  columns: LifecycleKanbanColumn[];
  scope: "mine" | "all";
  mine_count: number;
  all_count: number;
};

const inputSchema = z
  .object({ scope: z.enum(["mine", "all"]).optional() })
  .optional();

export const listLifecycleKanban = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ context, data }): Promise<LifecycleKanbanResult> => {
    const scope: "mine" | "all" = data?.scope ?? "mine";

    // Count how many the user owns vs total workspace (via admin, read-only, ids only)
    const { count: mineCount } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true });

    let allCount = mineCount ?? 0;
    let productsClient = context.supabase;

    if (scope === "all") {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      productsClient = supabaseAdmin as typeof context.supabase;
      const { count: total } = await productsClient
        .from("products")
        .select("id", { count: "exact", head: true });
      allCount = total ?? 0;
    } else {
      // still get the total to power the banner
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { count: total } = await (supabaseAdmin as typeof context.supabase)
        .from("products")
        .select("id", { count: "exact", head: true });
      allCount = total ?? mineCount ?? 0;
    }

    const emptyColumns = WORKFLOW_STEPS.map((step) => ({ step, cards: [] as LifecycleKanbanCard[] }));

    // 1) products (respecting chosen scope)
    const { data: products, error: pErr } = await productsClient
      .from("products")
      .select("id, sku, name, image_url, collection_id, collections(name)")
      .order("updated_at", { ascending: false })
      .limit(400);
    if (pErr) throw new Error(pErr.message);
    const productIds = (products ?? []).map((p) => p.id);
    if (productIds.length === 0) {
      return {
        columns: emptyColumns,
        scope,
        mine_count: mineCount ?? 0,
        all_count: allCount,
      };
    }

    // 2) all workflow steps for those products (admin when scope=all so we don't
    //    filter by owner_id via RLS)
    const stepsClient = scope === "all" ? productsClient : context.supabase;
    const { data: steps, error: sErr } = await stepsClient
      .from("product_workflow_steps")
      .select("product_id, step, step_order, status, started_at, updated_at, blocker_reason")
      .in("product_id", productIds)
      .order("step_order", { ascending: true });
    if (sErr) throw new Error(sErr.message);

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

    const columns = WORKFLOW_STEPS.map((step) => ({
      step,
      cards: (cardsByStep.get(step) ?? []).sort(
        (a, b) => (b.blocked ? 1 : 0) - (a.blocked ? 1 : 0) || b.days_in_step - a.days_in_step,
      ),
    }));

    return {
      columns,
      scope,
      mine_count: mineCount ?? 0,
      all_count: allCount,
    };
  });
