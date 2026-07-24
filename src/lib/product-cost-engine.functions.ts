/**
 * Onda 19 — Cost Engine Reativo
 * Histórico de custo + preço sugerido reativo à ficha técnica.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CostHistoryPoint = {
  id: string;
  createdAt: string;
  materialsCost: number;
  laborCost: number;
  overheadPct: number;
  totalCost: number;
  targetCost: number | null;
  status: string;
  reason: string | null;
};

export type PriceSuggestion = {
  currentCost: number | null;
  targetMarginPct: number | null;
  suggestedPrice: number | null;
  currentRetail: number | null;
  gapPct: number | null;
};

export const getProductCostHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ productId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CostHistoryPoint[]> => {
    const { data: rows, error } = await context.supabase
      .from("product_cost_history")
      .select("id, created_at, materials_cost, labor_cost, overhead_pct, total_cost, target_cost, status, reason")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      createdAt: r.created_at as string,
      materialsCost: Number(r.materials_cost ?? 0),
      laborCost: Number(r.labor_cost ?? 0),
      overheadPct: Number(r.overhead_pct ?? 0),
      totalCost: Number(r.total_cost ?? 0),
      targetCost: r.target_cost != null ? Number(r.target_cost) : null,
      status: (r.status as string) ?? "ok",
      reason: (r.reason as string) ?? null,
    }));
  });

export const getSuggestedRetailPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PriceSuggestion> => {
    const { data: rows, error } = await context.supabase.rpc("suggest_retail_price", {
      _product_id: data.productId,
    });
    if (error) throw new Error(error.message);
    const r = (rows ?? [])[0] as
      | {
          current_cost: number | null;
          target_margin_pct: number | null;
          suggested_price: number | null;
          current_retail: number | null;
          gap_pct: number | null;
        }
      | undefined;
    return {
      currentCost: r?.current_cost != null ? Number(r.current_cost) : null,
      targetMarginPct: r?.target_margin_pct != null ? Number(r.target_margin_pct) : null,
      suggestedPrice: r?.suggested_price != null ? Number(r.suggested_price) : null,
      currentRetail: r?.current_retail != null ? Number(r.current_retail) : null,
      gapPct: r?.gap_pct != null ? Number(r.gap_pct) : null,
    };
  });
