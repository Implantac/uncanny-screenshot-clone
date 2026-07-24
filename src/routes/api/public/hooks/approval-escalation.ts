import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron — a cada 6h envia lembrete push para aprovações pendentes há > 48h.
 * Deduplica por (approver_id, product_id, gate_key) em janela de 24h.
 * Respeita notification_preferences (category='approval').
 * Auth: apikey (SUPABASE_PUBLISHABLE_KEY) OU x-cron-secret (CRON_SECRET).
 */
export const Route = createFileRoute("/api/public/hooks/approval-escalation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { timingSafeEqual } = await import("crypto");
        const safeEq = (a: string, b: string) => {
          if (!a || !b) return false;
          const ba = Buffer.from(a);
          const bb = Buffer.from(b);
          return ba.length === bb.length && timingSafeEqual(ba, bb);
        };
        const apiKey = request.headers.get("apikey") ?? "";
        const cronSecret = request.headers.get("x-cron-secret") ?? "";
        if (
          !safeEq(apiKey, process.env.SUPABASE_PUBLISHABLE_KEY ?? "") &&
          !safeEq(cronSecret, process.env.CRON_SECRET ?? "")
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const dedupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: stale, error } = await supabaseAdmin
          .from("product_approvals")
          .select("id, approver_id, product_id, gate_key, created_at, products(name)")
          .eq("decision", "pendente")
          .not("approver_id", "is", null)
          .lt("created_at", cutoff)
          .limit(2000);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const rows = (stale ?? []) as Array<{
          id: string;
          approver_id: string;
          product_id: string;
          gate_key: string;
          created_at: string;
          products: { name: string | null } | { name: string | null }[] | null;
        }>;
        if (rows.length === 0) return Response.json({ ok: true, sent: 0 });

        const approverIds = Array.from(new Set(rows.map((r) => r.approver_id)));
        const prefs = new Map<string, { muted: boolean; push: boolean }>();
        const { data: prefRows } = await supabaseAdmin
          .from("notification_preferences")
          .select("user_id, muted, push_enabled")
          .eq("category", "approval")
          .in("user_id", approverIds);
        for (const p of prefRows ?? []) {
          prefs.set(p.user_id as string, {
            muted: !!p.muted,
            push: (p as { push_enabled: boolean | null }).push_enabled !== false,
          });
        }

        let sent = 0;
        let skipped = 0;
        for (const r of rows) {
          const pref = prefs.get(r.approver_id);
          if (pref && (pref.muted || !pref.push)) {
            skipped++;
            continue;
          }

          // dedupe: já enviamos lembrete nas últimas 24h para este par?
          const { data: dupe } = await supabaseAdmin
            .from("push_notifications")
            .select("id")
            .eq("owner_id", r.approver_id)
            .eq("kind", "approval_reminder")
            .contains("payload", { approval_id: r.id })
            .gte("created_at", dedupeSince)
            .limit(1);
          if (dupe && dupe.length > 0) continue;

          const productName = Array.isArray(r.products)
            ? r.products[0]?.name
            : r.products?.name;
          const ageH = Math.floor(
            (Date.now() - Date.parse(r.created_at)) / 3_600_000,
          );

          await supabaseAdmin.from("push_notifications").insert({
            owner_id: r.approver_id,
            kind: "approval_reminder",
            severity: ageH > 168 ? "alta" : "media",
            title: `Aprovação parada há ${ageH}h`,
            body: `${productName ?? "Produto"} · gate ${r.gate_key}`,
            link: `/produto/${r.product_id}`,
            payload: {
              approval_id: r.id,
              product_id: r.product_id,
              gate_key: r.gate_key,
              age_hours: ageH,
            },
          });
          sent++;
        }

        return Response.json({ ok: true, sent, skipped, candidates: rows.length });
      },
    },
  },
});
