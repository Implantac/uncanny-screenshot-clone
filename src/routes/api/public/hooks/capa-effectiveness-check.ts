import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Wave 24 — CAPA effectiveness loop
 * POST /api/public/hooks/capa-effectiveness-check
 *
 * Varre CAPAs concluídas/verificadas nos últimos 90 dias (com pelo menos 15d
 * de "carência" após o fechamento) e verifica se houve reincidência
 * (inspeções reprovadas + ocorrências negativas) para o mesmo fornecedor
 * ou produto/OP dentro da janela pós-fechamento. Se sim, reabre a CAPA,
 * marca o motivo em effectiveness_check e dispara push para o dono.
 *
 * Body opcional: { dryRun?: boolean, thresholdRecurrences?: number }
 */

const KIND_NEGATIVE = [
  "negativa",
  "falta_material",
  "erro_corte",
  "defeito_costura",
  "quebra_maquina",
  "atraso_fornecedor",
  "retrabalho",
  "descarte",
];

const GRACE_DAYS = 15;
const SCAN_WINDOW_DAYS = 90;
const DEFAULT_THRESHOLD = 2;

type Body = { dryRun?: boolean; thresholdRecurrences?: number };

function verifyAuth(request: Request): boolean {
  const apiKey = request.headers.get("apikey");
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedApi = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const expectedCron = process.env.CRON_SECRET;
  if (expectedApi && apiKey === expectedApi) return true;
  if (expectedCron && cronSecret === expectedCron) return true;
  return false;
}

export const Route = createFileRoute("/api/public/hooks/capa-effectiveness-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyAuth(request)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          body = {};
        }
        const dryRun = Boolean(body.dryRun);
        const threshold = Math.max(1, Math.min(20, body.thresholdRecurrences ?? DEFAULT_THRESHOLD));

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response(JSON.stringify({ error: "missing supabase env" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient<Database>(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const now = Date.now();
        const scanFrom = new Date(now - SCAN_WINDOW_DAYS * 86400_000).toISOString();
        const graceCutoff = new Date(now - GRACE_DAYS * 86400_000).toISOString();

        const { data: capas, error } = await supabase
          .from("quality_capa")
          .select(
            "id, owner_id, title, supplier_id, order_id, status, closed_at, effectiveness_check",
          )
          .in("status", ["concluida", "verificada"])
          .gte("closed_at", scanFrom)
          .lte("closed_at", graceCutoff)
          .limit(500);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const eligible = (capas ?? []).filter((c) => {
          if (!c.closed_at) return false;
          const marker = `[reopened:${c.closed_at}]`;
          return !(c.effectiveness_check ?? "").includes(marker);
        });

        // Resolve product_id from CAPA.order_id (for product-level recurrence)
        const orderIds = Array.from(
          new Set(eligible.map((c) => c.order_id).filter(Boolean) as string[]),
        );
        const orderProductMap = new Map<string, string | null>();
        if (orderIds.length) {
          const { data: orders } = await supabase
            .from("production_orders")
            .select("id, product_id")
            .in("id", orderIds);
          (orders ?? []).forEach((o) => orderProductMap.set(o.id, o.product_id ?? null));
        }

        let reopened = 0;
        const details: Array<{
          capa_id: string;
          recurrences: number;
          reason: string;
          reopened: boolean;
        }> = [];

        for (const capa of eligible) {
          const closedAt = capa.closed_at!;
          const productId = capa.order_id ? orderProductMap.get(capa.order_id) ?? null : null;

          // Reincidence: inspections reprovado + occurrences negative
          // Scope: supplier_id OR product_id (via production_orders)
          let inspReprovadas = 0;
          if (capa.supplier_id) {
            const { count } = await supabase
              .from("quality_inspections")
              .select("id", { count: "exact", head: true })
              .eq("owner_id", capa.owner_id)
              .eq("supplier_id", capa.supplier_id)
              .in("result", ["reprovado", "reprovada"])
              .gte("created_at", closedAt);
            inspReprovadas += count ?? 0;
          }

          let occNegs = 0;
          // occurrences for the same supplier's orders OR same product's orders
          let scopedOrderIds: string[] = [];
          if (capa.supplier_id) {
            const { data: sOrders } = await supabase
              .from("production_orders")
              .select("id")
              .eq("owner_id", capa.owner_id)
              .eq("supplier_id", capa.supplier_id);
            scopedOrderIds.push(...((sOrders ?? []).map((o) => o.id) as string[]));
          }
          if (productId) {
            const { data: pOrders } = await supabase
              .from("production_orders")
              .select("id")
              .eq("owner_id", capa.owner_id)
              .eq("product_id", productId);
            scopedOrderIds.push(...((pOrders ?? []).map((o) => o.id) as string[]));
          }
          scopedOrderIds = Array.from(new Set(scopedOrderIds));
          if (scopedOrderIds.length) {
            const { count } = await supabase
              .from("production_occurrences")
              .select("id", { count: "exact", head: true })
              .eq("owner_id", capa.owner_id)
              .in("order_id", scopedOrderIds)
              .in("kind", KIND_NEGATIVE)
              .gte("created_at", closedAt);
            occNegs += count ?? 0;
          }

          const total = inspReprovadas + occNegs;
          const detail = {
            capa_id: capa.id,
            recurrences: total,
            reason: `${inspReprovadas} inspeção(ões) reprovada(s) e ${occNegs} ocorrência(s) negativa(s) após fechamento`,
            reopened: false,
          };

          if (total >= threshold) {
            if (!dryRun) {
              const marker = `[reopened:${closedAt}]`;
              const noteAppend = `${marker} Reaberta automaticamente em ${new Date().toISOString()}: ${detail.reason}.`;
              const newCheck = capa.effectiveness_check
                ? `${capa.effectiveness_check}\n${noteAppend}`
                : noteAppend;

              const { error: updErr } = await supabase
                .from("quality_capa")
                .update({
                  status: "em_andamento",
                  effectiveness_check: newCheck,
                  closed_at: null,
                  verified_at: null,
                  verified_by: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", capa.id);
              if (updErr) {
                console.error("capa reopen failed", capa.id, updErr.message);
                continue;
              }

              await supabase.from("push_notifications").insert({
                owner_id: capa.owner_id,
                title: "CAPA reaberta — ação sem efetividade",
                body: `${capa.title}: ${detail.reason}.`,
                link: `/quality`,
                kind: "capa_reopened",
                severity: total >= threshold * 2 ? "alta" : "media",
                payload: {
                  capa_id: capa.id,
                  recurrences: total,
                  supplier_id: capa.supplier_id,
                  product_id: productId,
                },
              });

              await supabase.from("audit_logs").insert({
                user_id: capa.owner_id,
                entity: "quality_capa",
                entity_id: capa.id,
                action: "reopened_ineffective",
                payload: {
                  recurrences: total,
                  inspecoes: inspReprovadas,
                  ocorrencias: occNegs,
                  reason: detail.reason,
                },
              });
            }
            detail.reopened = true;
            reopened += 1;
          }
          details.push(detail);
        }

        return new Response(
          JSON.stringify({
            success: true,
            dryRun,
            threshold,
            scanned: eligible.length,
            reopened,
            details,
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
