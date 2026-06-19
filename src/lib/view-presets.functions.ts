import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ModuleInput = z.object({ module: z.string().min(1).max(64) });

export const listViewPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ModuleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("user_view_presets")
      .select("id, name, filters, is_favorite, updated_at")
      .eq("user_id", context.userId)
      .eq("module", data.module)
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SaveInput = z.object({
  module: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  filters: z.record(z.string(), z.unknown()),
  is_favorite: z.boolean().optional(),
});

export const saveViewPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("user_view_presets")
      .upsert(
        {
          user_id: context.userId,
          module: data.module,
          name: data.name,
          filters: data.filters,
          is_favorite: data.is_favorite ?? false,
        } as never,
        { onConflict: "user_id,module,name" },
      )
      .select("id, name, filters, is_favorite, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const IdInput = z.object({ id: z.string().uuid() });

export const deleteViewPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_view_presets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleFavoriteViewPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), is_favorite: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_view_presets")
      .update({ is_favorite: data.is_favorite } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
