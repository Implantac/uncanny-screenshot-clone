import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProductMarketingRoiRow = {
  productId: string;
  sku: string;
  name: string;
  collectionId: string | null;
  collectionName: string | null;
  units: number;
  revenue: number;
  estimatedCogs: number;
  marketingCost: number;
  grossProfit: number;
  netProfit: number;
  roas: number | null;
  roiPct: number | null;
  contributionMarginPct: number | null;
  verdict: "escalar" | "manter" | "corrigir" | "sem_dados";
};

export type CollectionMarketingRoiRow = {
  collectionId: string;
  collectionName: string;
  products: number;
  units: number;
  revenue: number;
  marketingCost: number;
  netProfit: number;
  roas: number | null;
  roiPct: number | null;
};

export type ProductMarketingRoiSummary = {
  days: number;
  products: number;
  units: number;
  revenue: number;
  estimatedCogs: number;
  marketingCost: number;
  netProfit: number;
  roas: number | null;
  roiPct: number | null;
};

export type ProductMarketingRoiResult = {
  rows: ProductMarketingRoiRow[];
  collections: CollectionMarketingRoiRow[];
  summary: ProductMarketingRoiSummary;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  collection_id: string | null;
  cost_price: number | null;
  sell_price: number | null;
  collections?: { name: string } | null;
};

type SaleRow = {
  sku: string | null;
  product_ref: string | null;
  quantity: number | null;
  total_value: number | null;
};

type MarketingCostRow = {
  product_id: string;
  collection_id: string | null;
  amount: number | null;
};

const inputSchema = z.object({
  days: z.number().int().min(7).max(730).default(90),
  collectionId: z.string().uuid().optional(),
});

function divide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function verdictFor(
  row: Pick<
    ProductMarketingRoiRow,
    "revenue" | "marketingCost" | "roiPct" | "contributionMarginPct"
  >,
): ProductMarketingRoiRow["verdict"] {
  if (row.revenue === 0 && row.marketingCost === 0) return "sem_dados";
  if ((row.roiPct ?? -999) >= 120 && (row.contributionMarginPct ?? -999) >= 25) return "escalar";
  if ((row.roiPct ?? -999) >= 30 && (row.contributionMarginPct ?? -999) >= 10) return "manter";
  return "corrigir";
}

export const listProductMarketingRoi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<ProductMarketingRoiResult> => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const productsQuery = supabase
      .from("products")
      .select("id, sku, name, collection_id, cost_price, sell_price, collections(name)")
      .order("name", { ascending: true });

    if (data.collectionId) productsQuery.eq("collection_id", data.collectionId);

    const [productsRes, salesRes, costsRes] = await Promise.all([
      productsQuery,
      supabase
        .from("erp_sales_mirror")
        .select("sku, product_ref, quantity, total_value")
        .gte("sold_at", since)
        .limit(10000),
      supabase
        .from("product_marketing_costs" as "products")
        .select("product_id, collection_id, amount")
        .gte("spent_at", since.slice(0, 10)),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (salesRes.error) throw salesRes.error;
    if (costsRes.error) throw costsRes.error;

    const products = (productsRes.data ?? []) as ProductRow[];
    const sales = (salesRes.data ?? []) as SaleRow[];
    const costs = (costsRes.data ?? []) as unknown as MarketingCostRow[];
    const productBySku = new Map(products.map((p) => [p.sku?.trim().toLowerCase(), p]));
    const productByName = new Map(products.map((p) => [p.name?.trim().toLowerCase(), p]));

    const salesByProduct = new Map<string, { units: number; revenue: number }>();
    sales.forEach((sale) => {
      const sku = sale.sku?.trim().toLowerCase();
      const ref = sale.product_ref?.trim().toLowerCase();
      const product = (sku && productBySku.get(sku)) || (ref && productByName.get(ref));
      if (!product) return;
      const cur = salesByProduct.get(product.id) ?? { units: 0, revenue: 0 };
      cur.units += Number(sale.quantity ?? 0);
      cur.revenue += Number(sale.total_value ?? 0);
      salesByProduct.set(product.id, cur);
    });

    const costsByProduct = new Map<string, number>();
    costs.forEach((cost) => {
      if (data.collectionId && cost.collection_id !== data.collectionId) return;
      costsByProduct.set(
        cost.product_id,
        (costsByProduct.get(cost.product_id) ?? 0) + Number(cost.amount ?? 0),
      );
    });

    const rows = products
      .map<ProductMarketingRoiRow>((product) => {
        const salesAgg = salesByProduct.get(product.id) ?? { units: 0, revenue: 0 };
        const marketingCost = costsByProduct.get(product.id) ?? 0;
        const estimatedUnitCost = Number(product.cost_price ?? 0);
        const fallbackUnitRevenue = Number(product.sell_price ?? 0);
        const revenue =
          salesAgg.revenue > 0 ? salesAgg.revenue : salesAgg.units * fallbackUnitRevenue;
        const estimatedCogs = estimatedUnitCost * salesAgg.units;
        const grossProfit = revenue - estimatedCogs;
        const netProfit = grossProfit - marketingCost;
        const roas = divide(revenue, marketingCost);
        const roiPct = marketingCost > 0 ? (netProfit / marketingCost) * 100 : null;
        const contributionMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : null;
        const base = {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          collectionId: product.collection_id,
          collectionName: product.collections?.name ?? null,
          units: salesAgg.units,
          revenue,
          estimatedCogs,
          marketingCost,
          grossProfit,
          netProfit,
          roas,
          roiPct,
          contributionMarginPct,
        };
        return { ...base, verdict: verdictFor(base) };
      })
      .filter((row) => row.revenue > 0 || row.marketingCost > 0)
      .sort((a, b) => b.netProfit - a.netProfit);

    const collectionMap = new Map<string, CollectionMarketingRoiRow>();
    rows.forEach((row) => {
      const id = row.collectionId ?? "sem-colecao";
      const cur = collectionMap.get(id) ?? {
        collectionId: id,
        collectionName: row.collectionName ?? "Sem coleção",
        products: 0,
        units: 0,
        revenue: 0,
        marketingCost: 0,
        netProfit: 0,
        roas: null,
        roiPct: null,
      };
      cur.products += 1;
      cur.units += row.units;
      cur.revenue += row.revenue;
      cur.marketingCost += row.marketingCost;
      cur.netProfit += row.netProfit;
      cur.roas = divide(cur.revenue, cur.marketingCost);
      cur.roiPct = cur.marketingCost > 0 ? (cur.netProfit / cur.marketingCost) * 100 : null;
      collectionMap.set(id, cur);
    });

    const summaryBase = rows.reduce(
      (acc, row) => {
        acc.units += row.units;
        acc.revenue += row.revenue;
        acc.estimatedCogs += row.estimatedCogs;
        acc.marketingCost += row.marketingCost;
        acc.netProfit += row.netProfit;
        return acc;
      },
      { units: 0, revenue: 0, estimatedCogs: 0, marketingCost: 0, netProfit: 0 },
    );

    return {
      rows: rows.slice(0, 150),
      collections: [...collectionMap.values()].sort((a, b) => b.netProfit - a.netProfit),
      summary: {
        days: data.days,
        products: rows.length,
        ...summaryBase,
        roas: divide(summaryBase.revenue, summaryBase.marketingCost),
        roiPct:
          summaryBase.marketingCost > 0
            ? (summaryBase.netProfit / summaryBase.marketingCost) * 100
            : null,
      },
    };
  });
