import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RegisterInput = z.object({
  user_name: z.string().min(1).max(80),
  platform: z.string().min(1).max(40),
  app_version: z.string().min(1).max(40),
  push_token: z.string().min(8).max(255),
  push_provider: z.enum(["web", "fcm", "expo", "apns"]).default("web"),
});

export const registerCurrentBrowserAsDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RegisterInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Reutiliza linha existente para o mesmo token, senão cria uma nova
    const { data: existing } = await supabase
      .from("mobile_devices")
      .select("id")
      .eq("owner_id", userId)
      .eq("push_token", data.push_token)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("mobile_devices")
        .update({
          user_name: data.user_name,
          platform: data.platform,
          app_version: data.app_version,
          push_provider: data.push_provider,
          push_enabled: true,
          active: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { id: existing.id, created: false };
    }

    const { data: row, error } = await supabase
      .from("mobile_devices")
      .insert({
        owner_id: userId,
        user_name: data.user_name,
        platform: data.platform,
        app_version: data.app_version,
        push_token: data.push_token,
        push_provider: data.push_provider,
        push_enabled: true,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, created: true };
  });

export const toggleDevicePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ device_id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mobile_devices")
      .update({ push_enabled: data.enabled })
      .eq("id", data.device_id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
