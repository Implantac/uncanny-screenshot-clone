import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EnqueueInput = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  link: z.string().max(500).optional(),
  kind: z.string().max(40).default("control_tower"),
  severity: z.enum(["critica", "alta", "media", "baixa"]).default("media"),
  payload: z.record(z.unknown()).optional(),
});

export const enqueuePushForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EnqueueInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: devices, error: de } = await supabase
      .from("mobile_devices")
      .select("id, push_enabled, push_token, active")
      .eq("owner_id", userId)
      .eq("active", true);
    if (de) throw new Error(de.message);

    const targets = (devices ?? []).filter((d) => d.push_enabled !== false);

    if (targets.length === 0) {
      const { data: row, error } = await supabase
        .from("push_notifications")
        .insert({
          owner_id: userId,
          device_id: null,
          title: data.title,
          body: data.body ?? null,
          link: data.link ?? null,
          kind: data.kind,
          severity: data.severity,
          payload: data.payload ?? null,
          error: "Nenhum dispositivo mobile ativo",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { enqueued: 0, withoutDevice: 1, ids: [row.id] };
    }

    const rows = targets.map((d) => ({
      owner_id: userId,
      device_id: d.id,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
      kind: data.kind,
      severity: data.severity,
      payload: data.payload ?? null,
      // simulação de entrega imediata (até plugar provedor externo)
      delivered_at: d.push_token ? new Date().toISOString() : null,
      error: d.push_token ? null : "Sem push_token registrado",
    }));

    const { data: inserted, error } = await supabase
      .from("push_notifications")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);

    return {
      enqueued: targets.length,
      withoutDevice: 0,
      ids: (inserted ?? []).map((r) => r.id),
    };
  });

export type RecentPush = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  severity: string;
  sent_at: string;
  delivered_at: string | null;
  error: string | null;
};

export const getRecentPushes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentPush[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("push_notifications")
      .select("id, title, body, link, kind, severity, sent_at, delivered_at, error")
      .eq("owner_id", userId)
      .order("sent_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as RecentPush[];
  });
