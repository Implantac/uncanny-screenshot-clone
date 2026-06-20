import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TechSheetCostAlert = {
  techSheetId: string;
  productName: string | null;
  sku: string | null;
  currentCost: number;
  previousCost: number;
  variationPct: number;
  fromVersion: number;
  toVersion: number | null;
  driver: "material" | "labor" | "overhead" | "misto";
};

const THRESHOLD = 10;

export const getTechSheetCostAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TechSheetCostAlert[]> => {
    const { supabase, userId } = context;

    const { data: sheets } = await supabase
      .from("tech_sheets")
      .select("id, cost_price, materials_cost, labor_cost, product_id")
      .eq("owner_id", userId)
      .gt("cost_price", 0);

    if (!sheets?.length) return [];

    const { data: versions } = await supabase
      .from("tech_sheet_versions")
      .select("tech_sheet_id, version_number, snapshot")
      .eq("owner_id", userId)
      .order("version_number", { ascending: false });

    type Snapshot = { sheet?: { cost_price?: number; materials_cost?: number; labor_cost?: number } };
    type VersionRow = { tech_sheet_id: string; version_number: number; snapshot: Snapshot | null };
    type SheetRow = { id: string; cost_price: number | null; materials_cost: number | null; labor_cost: number | null; product_id: string | null };
    type ProductRow = { id: string; name: string | null; sku: string | null };

    const lastBySheet = new Map<string, { v: number; snap: Snapshot | null }>();
    ((versions ?? []) as VersionRow[]).forEach((v) => {
      if (!lastBySheet.has(v.tech_sheet_id)) {
        lastBySheet.set(v.tech_sheet_id, { v: v.version_number, snap: v.snapshot });
      }
    });

    const sheetRows = (sheets ?? []) as SheetRow[];
    const productIds = sheetRows.map((s) => s.product_id).filter((id): id is string => !!id);
    const { data: products } = productIds.length
      ? await supabase.from("products").select("id, name, sku").in("id", productIds)
      : { data: [] as ProductRow[] };
    const prodMap = new Map(((products ?? []) as ProductRow[]).map((p) => [p.id, p]));

    const alerts: TechSheetCostAlert[] = [];
    for (const s of sheetRows) {
      const prev = lastBySheet.get(s.id);
      if (!prev) continue;
      const prevCost = Number(prev.snap?.sheet?.cost_price ?? 0);
      const curCost = Number(s.cost_price ?? 0);
      if (prevCost <= 0) continue;
      const variation = ((curCost - prevCost) / prevCost) * 100;
      if (Math.abs(variation) < THRESHOLD) continue;

      const prevMat = Number(prev.snap?.sheet?.materials_cost ?? 0);
      const prevLab = Number(prev.snap?.sheet?.labor_cost ?? 0);
      const dMat = Math.abs(Number(s.materials_cost ?? 0) - prevMat);
      const dLab = Math.abs(Number(s.labor_cost ?? 0) - prevLab);
      const dOh = Math.abs(curCost - prevCost - dMat - dLab);
      const max = Math.max(dMat, dLab, dOh);
      const driver: TechSheetCostAlert["driver"] =
        max === 0 ? "misto" : max === dMat ? "material" : max === dLab ? "labor" : "overhead";

      const prod = s.product_id ? prodMap.get(s.product_id) : null;
      alerts.push({
        techSheetId: s.id,
        productName: prod?.name ?? null,
        sku: prod?.sku ?? null,
        currentCost: curCost,
        previousCost: prevCost,
        variationPct: variation,
        fromVersion: prev.v,
        toVersion: null,
        driver,
      });
    }

    alerts.sort((a, b) => Math.abs(b.variationPct) - Math.abs(a.variationPct));
    return alerts;
  });
