import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron diário (08:00 BRT / 11:00 UTC) — marca OPs vencidas como `atrasada`,
 * cria uma `production_occurrence` e dispara `push_notification` para o owner.
 *
 * Idempotente: só converte OPs que ainda não estão em status final ou atrasada.
 */
export const Route = createFileRoute("/api/public/hooks/mark-late-ops")({
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
        const today = new Date().toISOString().slice(0, 10);

        const { data: ops, error } = await supabaseAdmin
          .from("production_orders")
          .select("id, owner_id, code, due_date, quantity, status, stage")
          .lt("due_date", today)
          .not("status", "in", "(concluida,cancelada,atrasada)")
          .limit(500);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        let flipped = 0;
        const errors: string[] = [];

        for (const op of ops ?? []) {
          if (!op.due_date) continue;
          const daysLate = Math.max(
            1,
            Math.floor((Date.now() - new Date(op.due_date).getTime()) / 86_400_000),
          );

          const { error: uErr } = await supabaseAdmin
            .from("production_orders")
            .update({ status: "atrasada" })
            .eq("id", op.id);
          if (uErr) {
            errors.push(`update ${op.code}: ${uErr.message}`);
            continue;
          }
          flipped++;

          // Ocorrência (uma por OP por dia — evita duplicar buscando hoje)
          const { data: existingOcc } = await supabaseAdmin
            .from("production_occurrences")
            .select("id")
            .eq("order_id", op.id)
            .eq("kind", "atraso")
            .gte("created_at", `${today}T00:00:00Z`)
            .limit(1);
          if (!existingOcc || existingOcc.length === 0) {
            await supabaseAdmin.from("production_occurrences").insert({
              owner_id: op.owner_id,
              order_id: op.id,
              kind: "atraso",
              status: "aberta",
              sector: op.stage,
              affected_qty: op.quantity ?? 0,
              description: `OP ${op.code} atrasada ${daysLate}d (vencimento ${op.due_date}). Marcação automática diária.`,
            });
          }

          await supabaseAdmin.from("push_notifications").insert({
            owner_id: op.owner_id,
            kind: "pcp",
            severity: daysLate >= 3 ? "alta" : "media",
            title: `OP atrasada · ${op.code}`,
            body: `${daysLate} dia(s) após o prazo. Reprogramar ou justificar.`,
            link: "/pcp-kanban",
            payload: { order_id: op.id, days_late: daysLate },
          });
        }

        return Response.json({
          ok: true,
          scanned: (ops ?? []).length,
          flipped,
          errors: errors.slice(0, 5),
        });
      },
    },
  },
});
