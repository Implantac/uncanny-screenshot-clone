import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SeasonalityScope = "category" | "product_group" | "product";

const ScopeSchema = z.enum(["category", "product_group", "product"]);

const MultipliersSchema = z
  .record(z.string(), z.number().min(0).max(5))
  .refine((m) => Object.keys(m).every((k) => /^([1-9]|1[0-2])$/.test(k)), {
    message: "Chaves devem ser meses 1..12",
  });

export const SEASON_PRESETS: Record<string, Record<string, number>> = {
  neutro: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 1])),
  verao: { "1": 1.6, "2": 1.4, "3": 1.1, "4": 0.9, "5": 0.7, "6": 0.5, "7": 0.5, "8": 0.7, "9": 0.9, "10": 1.1, "11": 1.4, "12": 1.6 },
  inverno: { "1": 0.6, "2": 0.6, "3": 0.8, "4": 1.1, "5": 1.4, "6": 1.8, "7": 1.8, "8": 1.4, "9": 1.1, "10": 0.8, "11": 0.6, "12": 0.6 },
};

export const listSeasonality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("seasonality_curves")
      .select("*")
      .eq("owner_id", context.userId)
      .order("scope", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSeasonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      scope: SeasonalityScope;
      scopeValue: string;
      productId?: string | null;
      multipliers: Record<string, number>;
      notes?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          scope: ScopeSchema,
          scopeValue: z.string().trim().max(120),
          productId: z.string().uuid().nullable().optional(),
          multipliers: MultipliersSchema,
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
      multipliers: data.multipliers,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("seasonality_curves")
        .update(row)
        .eq("id", data.id)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("seasonality_curves")
      .upsert(row, { onConflict: "owner_id,scope,scope_value,product_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const deleteSeasonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("seasonality_curves")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
