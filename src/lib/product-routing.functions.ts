import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type RoutingStep = {
  id: string;
  product_id: string | null;
  family_id: string | null;
  stage_key: string;
  sequence: number;
  sla_days: number;
  required: boolean;
  notes: string | null;
};

export const listProductRoutings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: routings }, { data: stages }, { data: products }, { data: families }] =
      await Promise.all([
        supabase
          .from("product_routing" as never)
          .select("*")
          .order("sequence", { ascending: true }),
        supabase.from("pcp_stages").select("key, label, position").eq("active", true).order("position"),
        supabase.from("products").select("id, sku, name"),
        supabase.from("product_families").select("id, name"),
      ]);
    return {
      routings: (routings ?? []) as unknown as RoutingStep[],
      stages: stages ?? [],
      products: products ?? [],
      families: families ?? [],
    };
  });

const upsertSchema = z.object({
  scope: z.enum(["product", "family"]),
  scopeId: z.string().uuid(),
  steps: z.array(
    z.object({
      stage_key: z.string().min(1),
      sequence: z.number().int().min(1),
      sla_days: z.number().int().min(0).max(365),
      required: z.boolean(),
      notes: z.string().max(500).nullable().optional(),
    }),
  ),
});

export const saveProductRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scopeFilter = data.scope === "product" ? { product_id: data.scopeId } : { family_id: data.scopeId };

    const { error: delErr } = await supabase
      .from("product_routing" as never)
      .delete()
      .match(scopeFilter as never);
    if (delErr) throw delErr;

    if (data.steps.length === 0) return { ok: true, inserted: 0 };

    const rows = data.steps.map((s) => ({
      owner_id: userId,
      product_id: data.scope === "product" ? data.scopeId : null,
      family_id: data.scope === "family" ? data.scopeId : null,
      stage_key: s.stage_key,
      sequence: s.sequence,
      sla_days: s.sla_days,
      required: s.required,
      notes: s.notes ?? null,
    }));

    const { error: insErr } = await supabase
      .from("product_routing" as never)
      .insert(rows as never);
    if (insErr) throw insErr;
    return { ok: true, inserted: rows.length };
  });

export const getRoutingForProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // 1) tenta routing específico do produto
    const { data: prod } = await supabase
      .from("products")
      .select("id, line_id")
      .eq("id", data.productId)
      .maybeSingle();

    const { data: byProduct } = await supabase
      .from("product_routing" as never)
      .select("*")
      .eq("product_id" as never, data.productId)
      .order("sequence", { ascending: true });
    if (byProduct && byProduct.length > 0) {
      return { source: "product" as const, steps: byProduct as unknown as RoutingStep[] };
    }
    // 2) tenta por família (collection_products role/line — usamos product_families se houver vínculo)
    if (prod?.line_id) {
      const { data: byFamily } = await supabase
        .from("product_routing" as never)
        .select("*")
        .eq("family_id" as never, prod.line_id)
        .order("sequence", { ascending: true });
      if (byFamily && byFamily.length > 0) {
        return { source: "family" as const, steps: byFamily as unknown as RoutingStep[] };
      }
    }
    // 3) fallback: pcp_stages globais
    const { data: stages } = await supabase
      .from("pcp_stages")
      .select("key, position")
      .eq("active", true)
      .order("position");
    const steps: RoutingStep[] = (stages ?? []).map((s, idx) => ({
      id: `default-${s.key}`,
      product_id: null,
      family_id: null,
      stage_key: s.key,
      sequence: idx + 1,
      sla_days: 2,
      required: true,
      notes: null,
    }));
    return { source: "default" as const, steps };
  });

export type ProductRoutingMap = Record<
  string,
  { source: "product" | "family" | "default"; stages: string[] }
>;

export const getRoutingsForProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productIds: z.array(z.string().uuid()).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ids = Array.from(new Set(data.productIds));
    const { data: stagesRows } = await supabase
      .from("pcp_stages")
      .select("key, position")
      .eq("active", true)
      .order("position");
    const defaultStages = (stagesRows ?? []).map((s) => s.key as string);

    const result: ProductRoutingMap = {};
    if (ids.length === 0) return { map: result, defaultStages };

    const { data: products } = await supabase
      .from("products")
      .select("id, line_id")
      .in("id", ids);
    const familyIds = Array.from(
      new Set((products ?? []).map((p) => p.line_id).filter(Boolean) as string[]),
    );

    const [{ data: byProduct }, { data: byFamily }] = await Promise.all([
      supabase
        .from("product_routing" as never)
        .select("product_id, stage_key, sequence")
        .in("product_id" as never, ids as never)
        .order("sequence", { ascending: true }),
      familyIds.length
        ? supabase
            .from("product_routing" as never)
            .select("family_id, stage_key, sequence")
            .in("family_id" as never, familyIds as never)
            .order("sequence", { ascending: true })
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const productStages = new Map<string, string[]>();
    for (const r of (byProduct ?? []) as Array<{ product_id: string; stage_key: string }>) {
      const arr = productStages.get(r.product_id) ?? [];
      arr.push(r.stage_key);
      productStages.set(r.product_id, arr);
    }
    const familyStages = new Map<string, string[]>();
    for (const r of (byFamily ?? []) as Array<{ family_id: string; stage_key: string }>) {
      const arr = familyStages.get(r.family_id) ?? [];
      arr.push(r.stage_key);
      familyStages.set(r.family_id, arr);
    }

    for (const id of ids) {
      const ps = productStages.get(id);
      if (ps && ps.length) {
        result[id] = { source: "product", stages: ps };
        continue;
      }
      const fam = (products ?? []).find((p) => p.id === id)?.line_id ?? null;
      const fs = fam ? familyStages.get(fam) : null;
      if (fs && fs.length) {
        result[id] = { source: "family", stages: fs };
        continue;
      }
      result[id] = { source: "default", stages: defaultStages };
    }
    return { map: result, defaultStages };
  });

