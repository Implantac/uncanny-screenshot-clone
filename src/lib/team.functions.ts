import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = ["admin", "gerente", "designer", "comprador", "vendedor"] as const;

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
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, avatar_url, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const byUser: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      (byUser[r.user_id] ??= []).push(r.role);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      roles: byUser[p.id] ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(ROLES),
      enabled: z.boolean(),
    }).parse(input),
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
