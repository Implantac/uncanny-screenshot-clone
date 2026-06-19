import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getWarRoomBottlenecks } from "@/lib/war-room.functions";

export type AutoPushResult = {
  totalCritical: number;
  enqueued: number;
  skipped: number;
  devicesReached: number;
};

export const autoPushCriticalBottlenecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutoPushResult> => {
    const { supabase, userId } = context;

    const bottlenecks = await getWarRoomBottlenecks();
    const criticals = bottlenecks.filter((b) => b.severity === "critica");
    if (criticals.length === 0) {
      return { totalCritical: 0, enqueued: 0, skipped: 0, devicesReached: 0 };
    }

    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent } = await supabase
      .from("push_notifications")
      .select("payload")
      .eq("owner_id", userId)
      .eq("kind", "war_room_auto")
      .gte("sent_at", cutoff);

    const sentIds = new Set<string>();
    for (const r of recent ?? []) {
      const p = r.payload as { bottleneck_id?: string } | null;
      if (p?.bottleneck_id) sentIds.add(p.bottleneck_id);
    }

    const fresh = criticals.filter((b) => !sentIds.has(b.id));
    if (fresh.length === 0) {
      return {
        totalCritical: criticals.length,
        enqueued: 0,
        skipped: criticals.length,
        devicesReached: 0,
      };
    }

    const { data: devices } = await supabase
      .from("mobile_devices")
      .select("id, push_token, push_enabled, active")
      .eq("owner_id", userId)
      .eq("active", true);

    const targets = (devices ?? []).filter((d) => d.push_enabled !== false);

    const rows: Array<Record<string, unknown>> = [];
    for (const b of fresh) {
      if (targets.length === 0) {
        rows.push({
          owner_id: userId,
          device_id: null,
          title: `🚨 [CRÍTICO] ${b.title}`,
          body: b.detail,
          link: b.action.route ?? null,
          kind: "war_room_auto",
          severity: "critica",
          payload: { bottleneck_id: b.id, module: b.module },
          error: "Nenhum dispositivo mobile ativo",
        });
      } else {
        for (const d of targets) {
          rows.push({
            owner_id: userId,
            device_id: d.id,
            title: `🚨 [CRÍTICO] ${b.title}`,
            body: b.detail,
            link: b.action.route ?? null,
            kind: "war_room_auto",
            severity: "critica",
            payload: { bottleneck_id: b.id, module: b.module },
            delivered_at: d.push_token ? new Date().toISOString() : null,
            error: d.push_token ? null : "Sem push_token registrado",
          });
        }
      }
    }

    const { error } = await supabase
      .from("push_notifications")
      .insert(rows as never);
    if (error) throw new Error(error.message);

    return {
      totalCritical: criticals.length,
      enqueued: fresh.length,
      skipped: criticals.length - fresh.length,
      devicesReached: targets.length,
    };
  });
