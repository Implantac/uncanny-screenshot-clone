import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BomReviewFlag = {
  techSheetId: string;
  code: string | null;
  version: string | null;
  status: string | null;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  reason: string | null;
  flaggedAt: string | null;
};

export const getTechSheetBomReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BomReviewFlag[]> => {
    const { supabase, userId } = context;

    const { data: sheets, error } = await supabase
      .from("tech_sheets")
      .select(
        "id, code, version, status, product_id, cost_review_reason, cost_review_flagged_at",
      )
      .eq("owner_id", userId)
      .eq("needs_cost_review", true)
      .order("cost_review_flagged_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    if (!sheets?.length) return [];

    const productIds = sheets
      .map((s) => s.product_id)
      .filter((id): id is string => !!id);

    const { data: products } = productIds.length
      ? await supabase
          .from("products")
          .select("id, name, sku")
          .in("id", productIds)
      : { data: [] as { id: string; name: string | null; sku: string | null }[] };

    const pmap = new Map(
      ((products ?? []) as { id: string; name: string | null; sku: string | null }[]).map(
        (p) => [p.id, p],
      ),
    );

    return sheets.map((s) => {
      const p = s.product_id ? pmap.get(s.product_id) : null;
      return {
        techSheetId: s.id,
        code: s.code,
        version: s.version,
        status: s.status,
        productId: s.product_id,
        productName: p?.name ?? null,
        sku: p?.sku ?? null,
        reason: s.cost_review_reason,
        flaggedAt: s.cost_review_flagged_at,
      };
    });
  });

export const acknowledgeTechSheetBomReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { techSheetId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tech_sheets")
      .update({
        needs_cost_review: false,
        cost_review_reason: null,
        cost_review_flagged_at: null,
      })
      .eq("id", data.techSheetId)
      .eq("owner_id", userId);
    if (error) throw error;

    await supabase.rpc("log_audit", {
      _entity: "tech_sheets",
      _entity_id: data.techSheetId,
      _action: "bom_review_acknowledged",
      _payload: { source: "tech_sheet_bom_review_panel" },
    });

    return { ok: true };
  });
