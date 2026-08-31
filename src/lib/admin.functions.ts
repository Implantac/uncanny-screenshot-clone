import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const ROLES = ["admin", "gerente", "designer", "comprador", "vendedor"] as const;
const PRODUCT_STATUS = [
  "rascunho",
  "desenvolvimento",
  "aprovado",
  "producao",
  "descontinuado",
] as const;

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: requer admin");
}

/* ---------------------------------- Usuários --------------------------------- */

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, authUsers] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }).catch(() => null),
    ]);
    const emailById = new Map<string, string>();
    for (const u of authUsers?.data?.users ?? []) emailById.set(u.id, u.email ?? "");
    const rolesByUser: Record<string, string[]> = {};
    for (const r of roles ?? []) (rolesByUser[r.user_id] ??= []).push(r.role);
    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: emailById.get(p.id) ?? null,
      createdAt: p.created_at,
      roles: rolesByUser[p.id] ?? [],
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
    z
      .object({ userId: z.string().uuid(), role: z.enum(ROLES), enabled: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; fullName: string }) =>
    z.object({ userId: z.string().uuid(), fullName: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- Categorias -------------------------------- */

export const adminListCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("product_lines")
      .select("id, name, description, season, year, display_order, created_at")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const categoryInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  season: z.string().max(60).nullable().optional(),
  year: z.number().int().min(1900).max(2200).nullable().optional(),
});

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof categoryInput>) => categoryInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      description: data.description ?? null,
      season: data.season ?? null,
      year: data.year ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("product_lines").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("product_lines")
        .insert({ ...payload, owner_id: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_lines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------- Produtos --------------------------------- */

export const adminListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string } | undefined) =>
    z.object({ search: z.string().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("products")
      .select("id, sku, name, category, status, cost_price, sell_price, line_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) q = q.or(`name.ilike.%${data.search}%,sku.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const productInput = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(160),
  category: z.string().max(80).nullable().optional(),
  status: z.enum(PRODUCT_STATUS),
  costPrice: z.number().min(0).nullable().optional(),
  sellPrice: z.number().min(0).nullable().optional(),
  lineId: z.string().uuid().nullable().optional(),
});

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof productInput>) => productInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      sku: data.sku,
      name: data.name,
      category: data.category ?? null,
      status: data.status,
      cost_price: data.costPrice ?? null,
      sell_price: data.sellPrice ?? null,
      line_id: data.lineId ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("products").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("products")
        .insert({ ...payload, owner_id: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
