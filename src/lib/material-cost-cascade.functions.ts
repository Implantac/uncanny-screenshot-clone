/**
 * Onda C — Cost Engine visível em cadeia
 * Dado um material, retorna todas as fichas técnicas que o consomem, os
 * produtos afetados e o delta de custo atual vs snapshot anterior.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CostCascadeRow = {
  techSheetId: string;
  techSheetCode: string | null;
  techSheetStatus: string;
  needsCostReview: boolean;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  currentCost: number;
  previousCost: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  targetCost: number | null;
  targetGapPct: number | null;
  updatedAt: string | null;
};

export type CostCascadeResult = {
  materialId: string;
  totalTechSheets: number;
  totalProducts: number;
  totalCostAtRisk: number;
  averageDeltaPct: number | null;
  rows: CostCascadeRow[];
};

export const getMaterialCostCascade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ materialId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CostCascadeResult> => {
    const { supabase, userId } = context;

    // 1. Fichas que usam o material (via RPC existente)
    const { data: usage, error: uErr } = await supabase.rpc("material_library_usage", {
      _material_id: data.materialId,
    });
    if (uErr) throw new Error(uErr.message);

    const usageRows = (usage ?? []) as Array<{
      tech_sheet_id: string;
      tech_sheet_code: string | null;
      tech_sheet_status: string;
      tech_sheet_updated_at: string | null;
      product_id: string | null;
      product_sku: string | null;
      product_name: string | null;
    }>;

    if (usageRows.length === 0) {
      return {
        materialId: data.materialId,
        totalTechSheets: 0,
        totalProducts: 0,
        totalCostAtRisk: 0,
        averageDeltaPct: null,
        rows: [],
      };
    }

    const sheetIds = usageRows.map((r) => r.tech_sheet_id);
    const productIds = Array.from(
      new Set(usageRows.map((r) => r.product_id).filter((v): v is string => !!v)),
    );

    // 2. Custo atual + flag needs_cost_review por ficha
    const { data: sheets } = await supabase
      .from("tech_sheets")
      .select("id, product_id, cost_price, needs_cost_review, updated_at")
      .in("id", sheetIds)
      .eq("owner_id", userId);

    const sheetById = new Map<string, { cost: number; review: boolean; updated: string | null; productId: string | null }>();
    for (const s of sheets ?? []) {
      sheetById.set(s.id as string, {
        cost: Number(s.cost_price ?? 0),
        review: Boolean(s.needs_cost_review),
        updated: (s.updated_at as string) ?? null,
        productId: (s.product_id as string) ?? null,
      });
    }

    // 3. Snapshot anterior por produto (product_cost_history) — pega os 2 mais recentes por produto
    const previousByProduct = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: hist } = await supabase
        .from("product_cost_history")
        .select("product_id, total_cost, created_at")
        .in("product_id", productIds)
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(productIds.length * 4);
      const seen = new Map<string, number>();
      for (const h of hist ?? []) {
        const pid = h.product_id as string;
        const count = seen.get(pid) ?? 0;
        if (count === 1) {
          // segundo snapshot = anterior
          previousByProduct.set(pid, Number(h.total_cost ?? 0));
        }
        seen.set(pid, count + 1);
      }
    }

    // 4. Meta de custo por produto
    const targetByProduct = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: targets } = await supabase
        .from("product_target_costs")
        .select("product_id, target_cost")
        .in("product_id", productIds)
        .eq("owner_id", userId);
      for (const t of targets ?? []) {
        if (t.target_cost != null) {
          targetByProduct.set(t.product_id as string, Number(t.target_cost));
        }
      }
    }

    const rows: CostCascadeRow[] = usageRows.map((r) => {
      const s = sheetById.get(r.tech_sheet_id);
      const current = s?.cost ?? 0;
      const previous = r.product_id ? previousByProduct.get(r.product_id) ?? null : null;
      const target = r.product_id ? targetByProduct.get(r.product_id) ?? null : null;
      const deltaAbs = previous != null ? current - previous : null;
      const deltaPct = previous != null && previous > 0 ? ((current - previous) / previous) * 100 : null;
      const targetGapPct = target != null && target > 0 ? ((current - target) / target) * 100 : null;
      return {
        techSheetId: r.tech_sheet_id,
        techSheetCode: r.tech_sheet_code,
        techSheetStatus: r.tech_sheet_status,
        needsCostReview: s?.review ?? false,
        productId: r.product_id,
        productSku: r.product_sku,
        productName: r.product_name,
        currentCost: current,
        previousCost: previous,
        deltaAbs,
        deltaPct,
        targetCost: target,
        targetGapPct,
        updatedAt: s?.updated ?? r.tech_sheet_updated_at,
      };
    });

    const totalCostAtRisk = rows.reduce(
      (sum, r) => sum + (r.deltaAbs != null && r.deltaAbs > 0 ? r.deltaAbs : 0),
      0,
    );
    const withDelta = rows.filter((r) => r.deltaPct != null);
    const avgDelta = withDelta.length
      ? withDelta.reduce((s, r) => s + (r.deltaPct as number), 0) / withDelta.length
      : null;

    // ordena por impacto (delta% desc, needs_review primeiro)
    rows.sort((a, b) => {
      if (a.needsCostReview !== b.needsCostReview) return a.needsCostReview ? -1 : 1;
      return Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0);
    });

    return {
      materialId: data.materialId,
      totalTechSheets: sheetIds.length,
      totalProducts: productIds.length,
      totalCostAtRisk,
      averageDeltaPct: avgDelta,
      rows,
    };
  });
