import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const APPROVAL_ROLES = ["modelagem", "custo", "comercial"] as const;
export type ApprovalRole = (typeof APPROVAL_ROLES)[number];

export const APPROVAL_ROLE_LABEL: Record<ApprovalRole, string> = {
  modelagem: "Modelagem",
  custo: "Custo",
  comercial: "Comercial",
};

export type ApprovalRow = {
  id: string;
  role: ApprovalRole;
  approvedAt: string;
  note: string | null;
  costAtApproval: number | null;
  targetCostAtApproval: number | null;
  approvedBy: string | null;
};

export type ApprovalContext = {
  prototypeId: string;
  approvals: ApprovalRow[];
  missing: ApprovalRole[];
  currentCost: number | null;
  targetCost: number | null;
  costGap: number | null; // (cost - target) / target
  canPromote: boolean;
};

export const getPrototypeApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prototypeId: string }) =>
    z.object({ prototypeId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ApprovalContext> => {
    const sb = context.supabase as any;
    const [{ data: rows }, { data: proto }] = await Promise.all([
      sb
        .from("prototype_approvals")
        .select(
          "id, role, approved_at, note, cost_at_approval, target_cost_at_approval, approved_by",
        )
        .eq("prototype_id", data.prototypeId),
      sb
        .from("prototypes")
        .select("id, product_id")
        .eq("id", data.prototypeId)
        .maybeSingle(),
    ]);

    let currentCost: number | null = null;
    let targetCost: number | null = null;
    if (proto?.product_id) {
      const [{ data: ts }, { data: tc }] = await Promise.all([
        sb
          .from("tech_sheets")
          .select("cost_price, status, updated_at")
          .eq("product_id", proto.product_id)
          .order("updated_at", { ascending: false })
          .limit(1),
        sb
          .from("product_target_costs")
          .select("target_cost")
          .eq("product_id", proto.product_id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      currentCost = ts?.[0]?.cost_price ?? null;
      targetCost = tc?.[0]?.target_cost ?? null;
    }

    const approvals: ApprovalRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      role: r.role,
      approvedAt: r.approved_at,
      note: r.note,
      costAtApproval: r.cost_at_approval,
      targetCostAtApproval: r.target_cost_at_approval,
      approvedBy: r.approved_by,
    }));

    const have = new Set(approvals.map((a) => a.role));
    const missing = APPROVAL_ROLES.filter((r) => !have.has(r));

    const costGap =
      currentCost != null && targetCost != null && targetCost > 0
        ? (currentCost - targetCost) / targetCost
        : null;

    return {
      prototypeId: data.prototypeId,
      approvals,
      missing,
      currentCost,
      targetCost,
      costGap,
      canPromote: missing.length === 0,
    };
  });

export const upsertPrototypeApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prototypeId: string; role: ApprovalRole; note?: string }) =>
    z
      .object({
        prototypeId: z.string().uuid(),
        role: z.enum(APPROVAL_ROLES),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;

    const { data: proto } = await sb
      .from("prototypes")
      .select("id, product_id")
      .eq("id", data.prototypeId)
      .maybeSingle();

    let costAtApproval: number | null = null;
    let targetCostAtApproval: number | null = null;
    if (proto?.product_id) {
      const [{ data: ts }, { data: tc }] = await Promise.all([
        sb
          .from("tech_sheets")
          .select("cost_price")
          .eq("product_id", proto.product_id)
          .order("updated_at", { ascending: false })
          .limit(1),
        sb
          .from("product_target_costs")
          .select("target_cost")
          .eq("product_id", proto.product_id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      costAtApproval = ts?.[0]?.cost_price ?? null;
      targetCostAtApproval = tc?.[0]?.target_cost ?? null;
    }

    const { error } = await sb.from("prototype_approvals").upsert(
      {
        owner_id: context.userId,
        prototype_id: data.prototypeId,
        role: data.role,
        note: data.note ?? null,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        cost_at_approval: costAtApproval,
        target_cost_at_approval: targetCostAtApproval,
      },
      { onConflict: "prototype_id,role" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokePrototypeApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prototypeId: string; role: ApprovalRole }) =>
    z
      .object({
        prototypeId: z.string().uuid(),
        role: z.enum(APPROVAL_ROLES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("prototype_approvals")
      .delete()
      .eq("prototype_id", data.prototypeId)
      .eq("role", data.role)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
