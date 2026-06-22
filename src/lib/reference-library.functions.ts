import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RefItemSource = "product" | "prototype";

export type RefItem = {
  id: string;
  source: RefItemSource;
  code: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
  colors: string[];
  collectionId: string | null;
  collectionName: string | null;
  season: string | null;
  year: number | null;
  status: string | null;
  stage: string | null;
  costPrice: number | null;
  sellPrice: number | null;
  supplierName: string | null;
  updatedAt: string;
  // sales signals (last 180d, products only)
  revenue: number;
  unitsSold: number;
  marginPct: number | null;
};

export type RefLibraryResponse = {
  items: RefItem[];
  totals: { products: number; prototypes: number };
  facets: {
    categories: { value: string; count: number }[];
    seasons: { value: string; count: number }[];
    collections: { id: string; name: string; count: number }[];
    colors: { value: string; count: number }[];
  };
};

export const listReferenceLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      search?: string;
      source?: "all" | RefItemSource;
      category?: string | null;
      season?: string | null;
      collectionId?: string | null;
      color?: string | null;
      limit?: number;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<RefLibraryResponse> => {
    const { supabase } = context;
    const limit = Math.min(data.limit ?? 500, 1000);
    const since = new Date(Date.now() - 180 * 86400_000).toISOString();

    const [{ data: products, error: pErr }, { data: protos, error: ptErr }] =
      await Promise.all([
        supabase
          .from("products")
          .select(
            "id, sku, name, image_url, category, colors, cost_price, sell_price, status, updated_at, collection_id, collections(name, season, year)",
          )
          .order("updated_at", { ascending: false })
          .limit(limit),
        supabase
          .from("prototypes")
          .select(
            "id, code, stage, current_sector, notes, updated_at, product_id, supplier_id, suppliers(name), products(name, image_url, category, colors, collection_id, collections(name, season, year))",
          )
          .order("updated_at", { ascending: false })
          .limit(limit),
      ]);
    if (pErr) throw pErr;
    if (ptErr) throw ptErr;

    // Sales aggregation by SKU (last 180d)
    const skus = (products ?? [])
      .map((p) => p.sku)
      .filter((s): s is string => !!s);
    const salesAgg = new Map<string, { qty: number; revenue: number }>();
    if (skus.length > 0) {
      const chunk = 200;
      for (let i = 0; i < skus.length; i += chunk) {
        const slice = skus.slice(i, i + chunk);
        const { data: sales } = await supabase
          .from("erp_sales_mirror")
          .select("sku, quantity, total_value")
          .gte("sold_at", since)
          .in("sku", slice);
        for (const s of sales ?? []) {
          if (!s.sku) continue;
          const k = s.sku.toLowerCase();
          const cur = salesAgg.get(k) ?? { qty: 0, revenue: 0 };
          cur.qty += Number(s.quantity ?? 0);
          cur.revenue += Number(s.total_value ?? 0);
          salesAgg.set(k, cur);
        }
      }
    }

    const items: RefItem[] = [];

    for (const p of products ?? []) {
      const col = (p as any).collections as
        | { name?: string; season?: string; year?: number }
        | null;
      const sales = salesAgg.get((p.sku ?? "").toLowerCase()) ?? {
        qty: 0,
        revenue: 0,
      };
      const cost = Number(p.cost_price ?? 0);
      const cmv = cost * sales.qty;
      const margin = sales.revenue - cmv;
      const marginPct =
        sales.revenue > 0 ? (margin / sales.revenue) * 100 : null;
      items.push({
        id: p.id,
        source: "product",
        code: p.sku,
        name: p.name,
        imageUrl: p.image_url ?? null,
        category: p.category ?? null,
        colors: (p.colors ?? []) as string[],
        collectionId: p.collection_id ?? null,
        collectionName: col?.name ?? null,
        season: col?.season ?? null,
        year: col?.year ?? null,
        status: p.status ?? null,
        stage: null,
        costPrice: p.cost_price ?? null,
        sellPrice: p.sell_price ?? null,
        supplierName: null,
        updatedAt: p.updated_at,
        revenue: sales.revenue,
        unitsSold: sales.qty,
        marginPct,
      });
    }

    for (const pt of protos ?? []) {
      const prod = (pt as any).products as any;
      const col = prod?.collections as
        | { name?: string; season?: string; year?: number }
        | null;
      items.push({
        id: pt.id,
        source: "prototype",
        code: pt.code,
        name: prod?.name ?? pt.code,
        imageUrl: prod?.image_url ?? null,
        category: prod?.category ?? null,
        colors: (prod?.colors ?? []) as string[],
        collectionId: prod?.collection_id ?? null,
        collectionName: col?.name ?? null,
        season: col?.season ?? null,
        year: col?.year ?? null,
        status: null,
        stage: pt.stage ?? null,
        costPrice: null,
        sellPrice: null,
        supplierName: ((pt as any).suppliers as { name?: string } | null)?.name ?? null,
        updatedAt: pt.updated_at,
        revenue: 0,
        unitsSold: 0,
        marginPct: null,
      });
    }

    // Filters
    const q = (data.search ?? "").trim().toLowerCase();
    const filtered = items.filter((it) => {
      if (data.source && data.source !== "all" && it.source !== data.source)
        return false;
      if (data.category && it.category !== data.category) return false;
      if (data.season && it.season !== data.season) return false;
      if (data.collectionId && it.collectionId !== data.collectionId)
        return false;
      if (data.color && !it.colors.some((c) => c?.toLowerCase() === data.color!.toLowerCase()))
        return false;
      if (q) {
        const hay = `${it.code} ${it.name} ${it.collectionName ?? ""} ${it.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Facets from the full unfiltered set
    const bump = <T extends string>(map: Map<T, number>, key: T | null | undefined) => {
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    };
    const cats = new Map<string, number>();
    const seasons = new Map<string, number>();
    const cols = new Map<string, { name: string; count: number }>();
    const colors = new Map<string, number>();
    for (const it of items) {
      bump(cats, it.category);
      bump(seasons, it.season);
      if (it.collectionId && it.collectionName) {
        const cur = cols.get(it.collectionId) ?? { name: it.collectionName, count: 0 };
        cur.count++;
        cols.set(it.collectionId, cur);
      }
      for (const c of it.colors) bump(colors, c);
    }
    const toArr = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 40);

    return {
      items: filtered
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
        .slice(0, limit),
      totals: {
        products: items.filter((i) => i.source === "product").length,
        prototypes: items.filter((i) => i.source === "prototype").length,
      },
      facets: {
        categories: toArr(cats),
        seasons: toArr(seasons),
        collections: Array.from(cols.entries())
          .map(([id, v]) => ({ id, name: v.name, count: v.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 40),
        colors: toArr(colors),
      },
    };
  });
