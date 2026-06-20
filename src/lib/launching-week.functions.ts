import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LaunchingItem = {
  collectionId: string;
  name: string;
  season: string | null;
  year: number | null;
  statusChangedAt: string;
  daysInLaunch: number;
  briefId: string | null;
  briefStatus: string | null;
  heroProductId: string | null;
  heroProductName: string | null;
  heroProductSku: string | null;
  productsCount: number;
};

export const getLaunchingThisWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LaunchingItem[]> => {
    const { supabase, userId } = context;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data: cols, error } = await supabase
      .from("collections")
      .select("id, name, season, year, status_changed_at")
      .eq("owner_id", userId)
      .eq("status", "lancamento")
      .gte("status_changed_at", sevenDaysAgo)
      .order("status_changed_at", { ascending: false });
    if (error) throw error;
    if (!cols?.length) return [];

    const ids = cols.map((c) => c.id);

    const [{ data: briefs }, { data: cps }] = await Promise.all([
      supabase
        .from("marketing_briefs")
        .select("id, collection_id, status, product_id")
        .eq("owner_id", userId)
        .in("collection_id", ids)
        .like("lifecycle_trigger", "[col-launch:%"),
      supabase
        .from("collection_products")
        .select("collection_id, product_id, role, products(name, sku)")
        .eq("owner_id", userId)
        .in("collection_id", ids),
    ]);

    type BriefRow = { id: string; collection_id: string | null; status: string | null; product_id: string | null };
    type CpRow = {
      collection_id: string;
      product_id: string;
      role: string | null;
      products: { name: string | null; sku: string | null } | null;
    };

    const briefByCol = new Map<string, BriefRow>();
    (briefs ?? []).forEach((b) => { if (b.collection_id) briefByCol.set(b.collection_id, b as BriefRow); });

    const countByCol = new Map<string, number>();
    const heroByCol = new Map<string, { id: string; name: string; sku: string }>();
    ((cps ?? []) as unknown as CpRow[]).forEach((cp) => {
      countByCol.set(cp.collection_id, (countByCol.get(cp.collection_id) ?? 0) + 1);
      if (cp.role === "hero" && !heroByCol.has(cp.collection_id) && cp.products) {
        heroByCol.set(cp.collection_id, {
          id: cp.product_id,
          name: cp.products.name ?? "",
          sku: cp.products.sku ?? "",
        });
      }
    });

    const now = Date.now();
    return cols.map((c) => {
      const b = briefByCol.get(c.id);
      const hero = heroByCol.get(c.id);
      const heroId = b?.product_id ?? hero?.id ?? null;
      return {
        collectionId: c.id,
        name: c.name,
        season: c.season,
        year: c.year,
        statusChangedAt: c.status_changed_at!,
        daysInLaunch: Math.max(0, Math.floor((now - new Date(c.status_changed_at!).getTime()) / (24 * 3600 * 1000))),
        briefId: b?.id ?? null,
        briefStatus: b?.status ?? null,
        heroProductId: heroId,
        heroProductName: hero?.name ?? null,
        heroProductSku: hero?.sku ?? null,
        productsCount: countByCol.get(c.id) ?? 0,
      };
    });
  });
