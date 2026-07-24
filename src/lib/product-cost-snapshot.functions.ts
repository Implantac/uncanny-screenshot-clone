/**
 * Product Cost Snapshot — Onda 4
 * Cruza ficha aprovada (BOM + operações + overhead), meta de custo e
 * preço médio de venda para dar visão viva da margem do produto.
 * Não duplica dados do ERP — apenas lê `erp_sales_mirror`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MaterialWeight = {
  materialId: string;
  name: string;
  totalCost: number;
  weightPct: number;
  supplierName: string | null;
};

export type ProductCostSnapshot = {
  productId: string;
  productName: string;
  sku: string | null;
  sheet: {
    id: string;
    status: string;
    materialsCost: number;
    laborCost: number;
    overheadPct: number;
    overheadCost: number;
    totalCost: number;
    updatedAt: string;
  } | null;
  target: {
    cost: number | null;
    marginPct: number | null;
    retailPrice: number | null;
  };
  market: {
    avgSalePrice: number | null;
    unitsSold90d: number;
    revenue90d: number;
  };
  gap: {
    absVsTarget: number | null;
    pctVsTarget: number | null;
    marginAbs: number | null;
    marginPct: number | null;
    status: "ok" | "atencao" | "estouro" | "sem_meta" | "sem_ficha";
  };
  drivers: MaterialWeight[];
};

export const getProductCostSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProductCostSnapshot> => {
    const sb = context.supabase;
    const { productId } = data;

    const [{ data: product }, { data: sheet }, { data: target }] = await Promise.all([
      sb.from("products").select("id, sku, name").eq("id", productId).maybeSingle(),
      sb
        .from("tech_sheets")
        .select(
          "id, status, materials_cost, labor_cost, cost_price, overhead_pct, updated_at",
        )
        .eq("product_id", productId)
        .order("status", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("product_target_costs")
        .select("target_cost, target_margin_pct, target_retail_price")
        .eq("product_id", productId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!product) throw new Error("Produto não encontrado");

    // BOM drivers (top materiais por peso)
    let drivers: MaterialWeight[] = [];
    if (sheet?.id) {
      const { data: mats } = await sb
        .from("tech_sheet_materials")
        .select("id, name, total_cost, inventory_item_id")
        .eq("tech_sheet_id", sheet.id);
      const list = ((mats ?? []) as Array<{
        id: string;
        name: string | null;
        total_cost: number | null;
        inventory_item_id: string | null;
      }>);
      const totalMat = list.reduce((a, m) => a + Number(m.total_cost ?? 0), 0) || 1;
      drivers = list
        .map((m) => ({
          materialId: m.id,
          name: m.name ?? "Material",
          totalCost: Number(m.total_cost ?? 0),
          weightPct: (Number(m.total_cost ?? 0) / totalMat) * 100,
          supplierName: null as string | null,
        }))
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);
    }

    // Vendas dos últimos 90d via ERP mirror (por SKU)
    let avgSalePrice: number | null = null;
    let units = 0;
    let revenue = 0;
    if (product.sku) {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: sales } = await sb
        .from("erp_sales_mirror")
        .select("quantity, total_value")
        .or(`sku.eq.${product.sku},product_ref.eq.${product.sku}`)
        .gte("sold_at", since)
        .limit(1000);
      const rows = ((sales ?? []) as Array<{ quantity: number | null; total_value: number | null }>);
      units = rows.reduce((a, r) => a + Number(r.quantity ?? 0), 0);
      revenue = rows.reduce((a, r) => a + Number(r.total_value ?? 0), 0);
      if (units > 0) avgSalePrice = revenue / units;
    }

    const materialsCost = Number(sheet?.materials_cost ?? 0);
    const laborCost = Number(sheet?.labor_cost ?? 0);
    const overheadPct = Number(sheet?.overhead_pct ?? 0);
    const totalCost = Number(sheet?.cost_price ?? 0);
    const overheadCost = Math.max(0, totalCost - materialsCost - laborCost);

    const targetCost = target?.target_cost != null ? Number(target.target_cost) : null;

    let status: ProductCostSnapshot["gap"]["status"] = "sem_ficha";
    let absVsTarget: number | null = null;
    let pctVsTarget: number | null = null;
    if (!sheet) status = "sem_ficha";
    else if (targetCost == null) status = "sem_meta";
    else {
      absVsTarget = totalCost - targetCost;
      pctVsTarget = targetCost > 0 ? (absVsTarget / targetCost) * 100 : 0;
      if (pctVsTarget > 5) status = "estouro";
      else if (pctVsTarget > 0) status = "atencao";
      else status = "ok";
    }

    let marginAbs: number | null = null;
    let marginPct: number | null = null;
    if (avgSalePrice != null && totalCost > 0) {
      marginAbs = avgSalePrice - totalCost;
      marginPct = (marginAbs / avgSalePrice) * 100;
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      sheet: sheet
        ? {
            id: sheet.id,
            status: sheet.status,
            materialsCost,
            laborCost,
            overheadPct,
            overheadCost,
            totalCost,
            updatedAt: sheet.updated_at,
          }
        : null,
      target: {
        cost: targetCost,
        marginPct: target?.target_margin_pct != null ? Number(target.target_margin_pct) : null,
        retailPrice:
          target?.target_retail_price != null ? Number(target.target_retail_price) : null,
      },
      market: {
        avgSalePrice,
        unitsSold90d: units,
        revenue90d: revenue,
      },
      gap: {
        absVsTarget,
        pctVsTarget,
        marginAbs,
        marginPct,
        status,
      },
      drivers,
    };
  });
