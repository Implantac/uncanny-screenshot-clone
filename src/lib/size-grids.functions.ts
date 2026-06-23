import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SizeGridScope = "category" | "product_group" | "product";

const ScopeSchema = z.enum(["category", "product_group", "product"]);

const DistributionSchema = z
  .record(z.string(), z.number().min(0).max(1))
  .refine(
    (d) => {
      const s = Object.values(d).reduce((a, b) => a + b, 0);
      return Object.keys(d).length === 0 || (s >= 0.95 && s <= 1.05);
    },
    { message: "Distribuição deve somar ~100% (0.95 a 1.05)" },
  );

export const listSizeGrids = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("size_grids")
      .select("*")
      .eq("owner_id", context.userId)
      .order("scope", { ascending: true })
      .order("scope_value", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSizeGrid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      scope: SizeGridScope;
      scopeValue: string;
      productId?: string | null;
      distribution: Record<string, number>;
      notes?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          scope: ScopeSchema,
          scopeValue: z.string().trim().max(120),
          productId: z.string().uuid().nullable().optional(),
          distribution: DistributionSchema,
          notes: z.string().max(500).nullable().optional(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      scope: data.scope,
      scope_value: data.scopeValue,
      product_id: data.productId ?? null,
      distribution: data.distribution,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("size_grids")
        .update(row)
        .eq("id", data.id)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("size_grids")
      .upsert(row, { onConflict: "owner_id,scope,scope_value,product_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const deleteSizeGrid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("size_grids")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
