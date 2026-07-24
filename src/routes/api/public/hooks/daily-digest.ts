import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron diário — envia um único push por usuário resumindo:
 *  • aprovações de produto pendentes onde ele é approver_id (ou sem approver e é owner)
 *  • @menções não vistas nas últimas 24h em product_timeline_comments
 *
 * Idempotente: agrupa por owner_id/user e cria 1 push com kind='digest'.
 * Autenticação: apikey (SUPABASE_PUBLISHABLE_KEY) OU x-cron-secret (CRON_SECRET).
 */
export const Route = createFileRoute("/api/public/hooks/daily-digest")({
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
        const expectedApi = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const expectedCron = process.env.CRON_SECRET ?? "";
        if (!safeEq(apiKey, expectedApi) && !safeEq(cronSecret, expectedCron)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 1) Aprovações pendentes (por approver_id)
        const { data: approvals, error: aErr } = await supabaseAdmin
          .from("product_approvals")
          .select("approver_id, product_id, gate_key")
          .eq("decision", "pendente")
          .not("approver_id", "is", null)
          .limit(5000);
        if (aErr) return Response.json({ error: aErr.message }, { status: 500 });

        // 2) Menções das últimas 24h
        const { data: mentions, error: mErr } = await supabaseAdmin
          .from("product_timeline_comments")
          .select("mentioned_user_ids, product_id, id, created_at")
          .gte("created_at", since)
          .not("mentioned_user_ids", "is", null)
          .limit(5000);
        if (mErr) return Response.json({ error: mErr.message }, { status: 500 });

        const perUser = new Map<string, { approvals: number; mentions: number }>();
        for (const a of approvals ?? []) {
          if (!a.approver_id) continue;
          const cur = perUser.get(a.approver_id) ?? { approvals: 0, mentions: 0 };
          cur.approvals++;
          perUser.set(a.approver_id, cur);
        }
        for (const m of mentions ?? []) {
          const ids = (m.mentioned_user_ids ?? []) as string[];
          for (const uid of ids) {
            const cur = perUser.get(uid) ?? { approvals: 0, mentions: 0 };
            cur.mentions++;
            perUser.set(uid, cur);
          }
        }

        // Preferências do usuário para categoria "digest"
        const userIds = Array.from(perUser.keys());
        const prefs = new Map<string, { muted: boolean; push: boolean }>();
        if (userIds.length > 0) {
          const { data: prefRows } = await supabaseAdmin
            .from("notification_preferences")
            .select("user_id, muted, push_enabled")
            .eq("category", "digest")
            .in("user_id", userIds);
          for (const p of prefRows ?? []) {
            prefs.set(p.user_id as string, {
              muted: !!p.muted,
              push: p.push_enabled !== false,
            });
          }
        }

        let sent = 0;
        let skipped_pref = 0;
        const today = new Date().toISOString().slice(0, 10);
        for (const [uid, counts] of perUser) {
          if (counts.approvals === 0 && counts.mentions === 0) continue;

          const pref = prefs.get(uid);
          if (pref && (pref.muted || !pref.push)) {
            skipped_pref++;
            continue;
          }

          // dedupe: 1 digest por usuário por dia
          const { data: exists } = await supabaseAdmin
            .from("push_notifications")
            .select("id")
            .eq("owner_id", uid)
            .eq("kind", "digest")
            .gte("created_at", `${today}T00:00:00Z`)
            .limit(1);
          if (exists && exists.length > 0) continue;

          const parts: string[] = [];
          if (counts.approvals > 0)
            parts.push(`${counts.approvals} aprovação(ões) pendente(s)`);
          if (counts.mentions > 0)
            parts.push(`${counts.mentions} menção(ões) novas`);

          await supabaseAdmin.from("push_notifications").insert({
            owner_id: uid,
            kind: "digest",
            severity: counts.approvals > 0 ? "media" : "baixa",
            title: "Resumo do dia · USE Fashion",
            body: parts.join(" · "),
            link: "/notificacoes",
            payload: counts,
          });
          sent++;
        }

        return Response.json({
          ok: true,
          users_with_activity: perUser.size,
          sent,
          skipped_pref,
        });
      },
    },
  },
});
