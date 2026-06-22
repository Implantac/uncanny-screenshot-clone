/**
 * Cron endpoint: puxa TODOS os dados do ERP Usesoft → PLM para cada owner ativo.
 *
 * Segurança: exige header `x-cron-secret` igual a process.env.CRON_SECRET.
 * Usa supabaseAdmin (bypassa RLS) e escopa cada operação por owner_id.
 *
 * Chamadas: pg_cron, manualmente para diagnóstico, ou um external scheduler.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/erp-pull-all")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({ error: "Missing CRON_SECRET" }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (provided !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {
          runSyncCollections, runSyncProducts, runSyncProductImages,
          runSyncCustomers, runSyncSuppliers,
        } = await import("@/lib/erp-sync-runners.server");


        const { data: configs, error: cfgErr } = await supabaseAdmin
          .from("erp_integration_config")
          .select("owner_id, active")
          .eq("active", true);
        if (cfgErr) {
          return new Response(JSON.stringify({ error: cfgErr.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }

        const results: Array<Record<string, unknown>> = [];
        for (const cfg of configs ?? []) {
          const ownerId = cfg.owner_id as string;
          const ownerResult: Record<string, unknown> = { owner_id: ownerId };
          const steps: Array<[string, () => Promise<unknown>]> = [
            // Sync restrito: apenas coleções e produtos ativos (+ imagens).
            ["collections", () => runSyncCollections(supabaseAdmin, ownerId)],
            ["products", () => runSyncProducts(supabaseAdmin, ownerId)],
            ["product_images", () => runSyncProductImages(supabaseAdmin, ownerId, 200)],
          ];
          for (const [label, fn] of steps) {
            try {
              ownerResult[label] = await fn();
            } catch (e) {
              ownerResult[label] = { error: e instanceof Error ? e.message : String(e) };
            }
          }
          await supabaseAdmin
            .from("erp_integration_config")
            .update({ last_inbound_at: new Date().toISOString() })
            .eq("owner_id", ownerId);
          results.push(ownerResult);
        }

        return new Response(JSON.stringify({ ok: true, owners: results.length, results }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
