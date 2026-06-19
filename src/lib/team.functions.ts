import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = ["admin", "gerente", "designer", "comprador", "vendedor"] as const;
const SECTORS = ["marketing", "pcp", "desenvolvimento"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: requer admin");
}

export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: sectors }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_sectors").select("user_id, sector"),
    ]);
    const rolesByUser: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      (rolesByUser[r.user_id] ??= []).push(r.role);
    }
    const sectorsByUser: Record<string, string[]> = {};
    for (const s of sectors ?? []) {
      (sectorsByUser[s.user_id] ??= []).push(s.sector);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      roles: rolesByUser[p.id] ?? [],
      sectors: sectorsByUser[p.id] ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(ROLES),
        enabled: z.boolean(),
      })
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

export const setUserSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; sector: (typeof SECTORS)[number]; enabled: boolean }) =>
    z
      .object({
        userId: z.string().uuid(),
        sector: z.enum(SECTORS),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_sectors")
        .upsert({ user_id: data.userId, sector: data.sector }, { onConflict: "user_id,sector" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_sectors")
        .delete()
        .eq("user_id", data.userId)
        .eq("sector", data.sector);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
