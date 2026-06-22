import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiReason } from "@/lib/ai-reason";

export type CarryOverCandidate = {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  sourceCollectionId: string;
  sourceCollectionName: string;
  units90d: number;
  revenue90d: number;
  lifetimeCollections: number;
  alreadyInTarget: boolean;
  suggestedRole: "carry_over" | "nos" | "hero";
  reason: string;
};

export type CollectionRosterRow = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  role: "hero" | "carry_over" | "nos" | "capsule" | "regular";
  state: "planned" | "active" | "markdown" | "discontinued" | "nos_permanent" | null;
  sourceCollectionId: string | null;
  introSeason: string | null;
  displayOrder: number;
};

export const getCarryOverContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { collectionId: string }) =>
    z.object({ collectionId: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ roster: CollectionRosterRow[]; candidates: CarryOverCandidate[] }> => {
      const sb = context.supabase;
      const iso90 = new Date(Date.now() - 90 * 86400000).toISOString();

      const [
        { data: cpRows },
        { data: lifecycle },
        { data: collections },
        { data: products },
        { data: sales },
        { data: cpAll },
      ] = await Promise.all([
        sb
          .from("collection_products")
          .select(
            "id, product_id, role, source_collection_id, intro_season, display_order, collection_id",
          )
          .eq("collection_id", data.collectionId),
        sb
          .from("product_lifecycle")
          .select("product_id, collection_id, state")
          .eq("collection_id", data.collectionId),
        sb.from("collections").select("id, name, launch_date"),
        sb.from("products").select("id, sku, name, image_url, collection_id"),
        sb
          .from("erp_sales_mirror")
          .select("sku, quantity, total_value")
          .gte("sold_at", iso90)
          .limit(5000),
        sb.from("collection_products").select("product_id, collection_id"),
      ]);

      type CpRow = { id: string; product_id: string; role: CollectionRosterRow["role"]; source_collection_id: string | null; intro_season: string | null; display_order: number; collection_id: string };
      type CpAllRow = { product_id: string; collection_id: string };
      type LifecycleRow = { product_id: string; collection_id: string; state: CollectionRosterRow["state"] };
      type CollectionRow = { id: string; name: string; launch_date: string | null };
      type ProductRow = { id: string; sku: string; name: string; image_url: string | null; collection_id: string | null };
      type SaleRow = { sku: string | null; quantity: number | null; total_value: number | null };

      const productMap = new Map(((products ?? []) as ProductRow[]).map((p) => [p.id, p]));
      const collectionMap = new Map(((collections ?? []) as CollectionRow[]).map((c) => [c.id, c]));
      const stateMap = new Map(
        ((lifecycle ?? []) as LifecycleRow[]).map((l) => [l.product_id, l.state]),
      );
      const salesBySku = new Map<string, { units: number; revenue: number }>();
      ((sales ?? []) as SaleRow[]).forEach((s) => {
        const k = s.sku ?? "—";
        const cur = salesBySku.get(k) ?? { units: 0, revenue: 0 };
        cur.units += Number(s.quantity ?? 0);
        cur.revenue += Number(s.total_value ?? 0);
        salesBySku.set(k, cur);
      });
      const lifetimeByProduct = new Map<string, number>();
      ((cpAll ?? []) as CpAllRow[]).forEach((r) => {
        lifetimeByProduct.set(r.product_id, (lifetimeByProduct.get(r.product_id) ?? 0) + 1);
      });

      const roster: CollectionRosterRow[] = ((cpRows ?? []) as CpRow[]).map((r) => {
        const p = productMap.get(r.product_id);
        return {
          id: r.id,
          productId: r.product_id,
          sku: p?.sku ?? "—",
          name: p?.name ?? "—",
          imageUrl: p?.image_url ?? null,
          role: r.role,
          state: stateMap.get(r.product_id) ?? null,
          sourceCollectionId: r.source_collection_id,
          introSeason: r.intro_season,
          displayOrder: r.display_order,
        };
      });

      const inTarget = new Set(roster.map((r) => r.productId));
      const target = collectionMap.get(data.collectionId);

      // Candidates: products from other collections, ranked by recent performance.
      const candidates: CarryOverCandidate[] = ((products ?? []) as ProductRow[])
        .filter((p) => p.collection_id && p.collection_id !== data.collectionId)
        .map((p) => {
          const s = salesBySku.get(p.sku) ?? { units: 0, revenue: 0 };
          const lifetime = lifetimeByProduct.get(p.id) ?? 1;
          const src = p.collection_id ? collectionMap.get(p.collection_id) : null;
          let suggestedRole: CarryOverCandidate["suggestedRole"] = "carry_over";
          let reason = "Mantém continuidade entre coleções.";
          if (lifetime >= 3 && s.units >= 60) {
            suggestedRole = "nos";
            reason = `${lifetime} coleções e ${s.units} un em 90d — candidato a NOS.`;
          } else if (s.revenue > 0 && s.units >= 30) {
            suggestedRole = "hero";
            reason = `${s.units} un · R$ ${Math.round(s.revenue).toLocaleString("pt-BR")} em 90d.`;
          }
          return {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            imageUrl: p.image_url ?? null,
            sourceCollectionId: p.collection_id ?? "",
            sourceCollectionName: src?.name ?? "—",
            units90d: s.units,
            revenue90d: s.revenue,
            lifetimeCollections: lifetime,
            alreadyInTarget: inTarget.has(p.id),
            suggestedRole,
            reason,
          };
        })
        .filter((c) => !c.alreadyInTarget)
        .sort((a, b) => b.revenue90d - a.revenue90d || b.units90d - a.units90d)
        .slice(0, 40);

      void target;
      return { roster, candidates };
    },
  );

const RoleEnum = z.enum(["hero", "carry_over", "nos", "capsule", "regular"]);

export const addProductToCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    productId: string;
    targetCollectionId: string;
    role: z.infer<typeof RoleEnum>;
    sourceCollectionId?: string | null;
    introSeason?: string | null;
  }) =>
    z
      .object({
        productId: z.string().uuid(),
        targetCollectionId: z.string().uuid(),
        role: RoleEnum,
        sourceCollectionId: z.string().uuid().nullable().optional(),
        introSeason: z.string().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ownerId = context.userId;

    const { error: cpErr } = await sb
      .from("collection_products")
      .upsert(
        {
          owner_id: ownerId,
          collection_id: data.targetCollectionId,
          product_id: data.productId,
          role: data.role,
          source_collection_id: data.sourceCollectionId ?? null,
          intro_season: data.introSeason ?? null,
        },
        { onConflict: "collection_id,product_id" },
      );
    if (cpErr) throw new Error(cpErr.message);

    const initialState =
      data.role === "nos" ? "nos_permanent" : data.role === "hero" ? "active" : "planned";

    const { error: lcErr } = await sb
      .from("product_lifecycle")
      .upsert(
        {
          owner_id: ownerId,
          product_id: data.productId,
          collection_id: data.targetCollectionId,
          state: initialState,
        },
        { onConflict: "product_id,collection_id" },
      );
    if (lcErr) throw new Error(lcErr.message);

    return { ok: true as const };
  });

export const removeProductFromCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string; collectionId: string }) =>
    z
      .object({ productId: z.string().uuid(), collectionId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("collection_products")
      .delete()
      .eq("collection_id", data.collectionId)
      .eq("product_id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setProductRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    productId: string;
    collectionId: string;
    role: z.infer<typeof RoleEnum>;
  }) =>
    z
      .object({
        productId: z.string().uuid(),
        collectionId: z.string().uuid(),
        role: RoleEnum,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("collection_products")
      .update({ role: data.role })
      .eq("collection_id", data.collectionId)
      .eq("product_id", data.productId);
    if (error) throw new Error(error.message);

    if (data.role === "nos") {
      await sb
        .from("product_lifecycle")
        .update({ state: "nos_permanent" })
        .eq("collection_id", data.collectionId)
        .eq("product_id", data.productId);
    }
    return { ok: true as const };
  });
