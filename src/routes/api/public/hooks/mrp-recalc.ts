import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron a cada 15 min — processa a fila `mrp_recalc_queue`.
 *
 * Para cada owner com recálculo pendente:
 *  1) executa o engine MRP (runMrpPlanning) com service-role como aquele owner;
 *  2) gera/atualiza alertas em marketing_notifications (crítico/cobertura/excesso),
 *     idempotente por (owner, item, dia);
 *  3) remove o owner da fila.
 *
 * A fila é populada por triggers AFTER INSERT/UPDATE em
 * `stock_movements` e `erp_inventory_mirror`, então o MRP é recalculado
 * automaticamente sempre que houver movimentação ou sync de ERP.
 */
export const Route = createFileRoute("/api/public/hooks/mrp-recalc")({
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
        const { runMrpPlanning } = await import("@/lib/mrp-planning.functions");

        const { data: queue, error: qErr } = await supabaseAdmin
          .from("mrp_recalc_queue")
          .select("owner_id, requested_at, reason")
          .order("requested_at", { ascending: true })
          .limit(25);
        if (qErr) return Response.json({ error: qErr.message }, { status: 500 });

        const today = new Date().toISOString().slice(0, 10);
        let processed = 0;
        let alertsCreated = 0;
        const errors: string[] = [];

        for (const row of queue ?? []) {
          const ownerId = row.owner_id as string;
          try {
            const planning = await runMrpPlanning(supabaseAdmin as never, ownerId, {});
            for (const r of planning.rows) {
              let kind: string | null = null;
              let title = "";
              let body = "";
              if (r.status === "critico") {
                kind = "mrp_critico";
                title = `MRP · ${r.sku} crítico`;
                body = `Saldo ${r.balance} ≤ PP ${r.reorderPoint}. Sugestão ${r.suggestedPurchase} ${r.unit}.`;
              } else if (
                r.coverageDays !== null &&
                r.coverageDays < 10 &&
                r.dailyConsumption > 0
              ) {
                kind = "mrp_cobertura";
                title = `MRP · ${r.sku} cobertura ${r.coverageDays}d`;
                body = `Restam ~${r.coverageDays} dias de cobertura. Sugestão ${r.suggestedPurchase} ${r.unit}.`;
              } else if (r.status === "excesso") {
                kind = "mrp_excesso";
                title = `MRP · ${r.sku} em excesso`;
                body = `Saldo ${r.balance} > Máx ${r.maximum}. Avalie remanejamento.`;
              }
              if (!kind) continue;

              const { data: existing } = await supabaseAdmin
                .from("marketing_notifications")
                .select("id")
                .eq("owner_id", ownerId)
                .eq("kind", kind)
                .eq("ref_id", r.id)
                .gte("created_at", today + "T00:00:00.000Z")
                .maybeSingle();
              if (existing) continue;

              const refKey = `${kind}:${r.id}:${today}`;
              const { error: nErr } = await supabaseAdmin
                .from("marketing_notifications")
                .insert({
                  owner_id: ownerId,
                  kind,
                  title,
                  body: body + ` [${refKey}]`,
                  link: "/mrp",
                  ref_id: r.id,
                });
              if (!nErr) alertsCreated++;
            }

            await supabaseAdmin
              .from("mrp_recalc_queue")
              .delete()
              .eq("owner_id", ownerId)
              .lte("requested_at", row.requested_at as string);
            processed++;
          } catch (e) {
            errors.push(`${ownerId}: ${(e as Error).message}`);
          }
        }

        return Response.json({
          ok: true,
          scanned: (queue ?? []).length,
          processed,
          alertsCreated,
          errors: errors.slice(0, 5),
        });
      },
    },
  },
});
