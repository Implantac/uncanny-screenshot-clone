import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AbcClass = "A" | "B" | "C";

export type AbcItem = {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  role: string;
  qty: number;
  revenue: number;
  costPrice: number | null;
  sellPrice: number | null;
  grossMargin: number | null;
  revenueShare: number;
  cumulativeShare: number;
  abcClass: AbcClass;
  orders: number;
};

export type AbcSummary = {
  collectionId: string;
  collectionName: string;
  windowDays: number;
  totalRevenue: number;
  totalQty: number;
  productsTotal: number;
  productsWithSales: number;
  productsNoSales: number;
  classCounts: Record<AbcClass, number>;
  classRevenue: Record<AbcClass, number>;
  topHero: AbcItem | null;
};

export type AbcResponse = {
  summary: AbcSummary;
  items: AbcItem[];
  deadStock: AbcItem[];
};

export const listCollectionsForAbc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("collections")
      .select("id, name, season, year, status")
      .order("year", { ascending: false })
      .order("name", { ascending: true })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const getCollectionAbc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { collectionId: string; windowDays?: number }) => d)
  .handler(async ({ data, context }): Promise<AbcResponse> => {
    const { supabase } = context;
    const windowDays = data.windowDays ?? 180;
    const since = new Date(Date.now() - windowDays * 86400_000).toISOString();

    const { data: col, error: colErr } = await supabase
      .from("collections")
      .select("id, name")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (colErr) throw colErr;
    if (!col) throw new Error("Coleção não encontrada");

    const { data: cps, error: cpsErr } = await supabase
      .from("collection_products")
      .select(
        "product_id, role, products(id, sku, name, image_url, cost_price, sell_price)",
      )
      .eq("collection_id", data.collectionId);
    if (cpsErr) throw cpsErr;

    type ProdMeta = {
      productId: string;
      sku: string;
      name: string;
      imageUrl: string | null;
      role: string;
      costPrice: number | null;
      sellPrice: number | null;
    };
    const products = new Map<string, ProdMeta>();
    const skuToId = new Map<string, string>();
    for (const cp of cps ?? []) {
      const p = (cp as any).products;
      if (!p) continue;
      const meta: ProdMeta = {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        imageUrl: p.image_url ?? null,
        role: (cp as any).role ?? "linha",
        costPrice: p.cost_price ?? null,
        sellPrice: p.sell_price ?? null,
      };
      products.set(p.id, meta);
      if (p.sku) skuToId.set(p.sku.toLowerCase(), p.id);
    }

    const skus = Array.from(skuToId.keys());
    type Agg = { qty: number; revenue: number; orders: number };
    const agg = new Map<string, Agg>();

    if (skus.length > 0) {
      // chunk in batches of 200 to stay within URL/IN limits
      const chunk = 200;
      for (let i = 0; i < skus.length; i += chunk) {
        const slice = skus.slice(i, i + chunk);
        const { data: sales, error: salesErr } = await supabase
          .from("erp_sales_mirror")
          .select("sku, quantity, total_value, sold_at")
          .gte("sold_at", since)
          .in("sku", slice);
        if (salesErr) throw salesErr;
        for (const s of sales ?? []) {
          const sku = (s as any).sku?.toLowerCase();
          if (!sku) continue;
          const pid = skuToId.get(sku);
          if (!pid) continue;
          const cur = agg.get(pid) ?? { qty: 0, revenue: 0, orders: 0 };
          cur.qty += Number((s as any).quantity ?? 0);
          cur.revenue += Number((s as any).total_value ?? 0);
          cur.orders += 1;
          agg.set(pid, cur);
        }
      }
    }

    // Build items
    const items: AbcItem[] = [];
    for (const meta of products.values()) {
      const a = agg.get(meta.productId) ?? { qty: 0, revenue: 0, orders: 0 };
      const margin =
        meta.sellPrice != null && meta.costPrice != null
          ? meta.sellPrice - meta.costPrice
          : null;
      items.push({
        productId: meta.productId,
        sku: meta.sku,
        name: meta.name,
        imageUrl: meta.imageUrl,
        role: meta.role,
        qty: a.qty,
        revenue: a.revenue,
        costPrice: meta.costPrice,
        sellPrice: meta.sellPrice,
        grossMargin: margin,
        revenueShare: 0,
        cumulativeShare: 0,
        abcClass: "C",
        orders: a.orders,
      });
    }

    items.sort((x, y) => y.revenue - x.revenue);
    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    let cum = 0;
    for (const it of items) {
      const share = totalRevenue > 0 ? it.revenue / totalRevenue : 0;
      it.revenueShare = share;
      cum += share;
      it.cumulativeShare = cum;
      it.abcClass =
        it.revenue <= 0 ? "C" : cum <= 0.8 ? "A" : cum <= 0.95 ? "B" : "C";
    }

    const classCounts: Record<AbcClass, number> = { A: 0, B: 0, C: 0 };
    const classRevenue: Record<AbcClass, number> = { A: 0, B: 0, C: 0 };
    for (const it of items) {
      classCounts[it.abcClass]++;
      classRevenue[it.abcClass] += it.revenue;
    }

    const productsWithSales = items.filter((i) => i.revenue > 0).length;
    const deadStock = items.filter((i) => i.revenue === 0);

    const summary: AbcSummary = {
      collectionId: col.id,
      collectionName: col.name,
      windowDays,
      totalRevenue,
      totalQty,
      productsTotal: items.length,
      productsWithSales,
      productsNoSales: items.length - productsWithSales,
      classCounts,
      classRevenue,
      topHero: items[0] && items[0].revenue > 0 ? items[0] : null,
    };

    return { summary, items, deadStock };
  });
