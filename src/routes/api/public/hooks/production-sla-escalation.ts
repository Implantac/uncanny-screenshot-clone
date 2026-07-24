import { createFileRoute } from "@tanstack/react-router";

/**
 * Wave 22 — Auto-escalação de SLA na produção.
 *
 * Cron (rodar a cada 2h): varre OPs abertas, cruza com product_routing para
 * obter sla_days por etapa e envia push para o owner do produto quando a OP
 * ultrapassa o SLA da etapa atual. Severidade "media" acima do SLA e "alta"
 * acima de 2× SLA. Deduplica por (owner_id, kind, order_id) em janela de 24h.
 * Respeita notification_preferences (category='pcp' quando existir; default:
 * enviar). Auth: apikey OU x-cron-secret.
 */
export const Route = createFileRoute("/api/public/hooks/production-sla-escalation")({
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
        const dedupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const now = Date.now();

        const { data: openOps, error } = await supabaseAdmin
          .from("production_orders")
          .select(
            "id, code, product_id, stage, stage_updated_at, created_at, quantity, products(name, owner_id)",
          )
          .in("status", ["aguardando", "em_producao"])
          .limit(5000);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const rows = (openOps ?? []) as Array<{
          id: string;
          code: string | null;
          product_id: string | null;
          stage: string;
          stage_updated_at: string | null;
          created_at: string;
          quantity: number | null;
          products:
            | { name: string | null; owner_id: string | null }
            | { name: string | null; owner_id: string | null }[]
            | null;
        }>;
        if (rows.length === 0) return Response.json({ ok: true, sent: 0 });

        // routing SLA map por produto+etapa
        const productIds = Array.from(
          new Set(rows.map((r) => r.product_id).filter((x): x is string => !!x)),
        );
        const slaMap = new Map<string, number>();
        if (productIds.length > 0) {
          const { data: routes } = await supabaseAdmin
            .from("product_routing")
            .select("product_id, stage_key, sla_days")
            .in("product_id", productIds);
          for (const r of routes ?? []) {
            if (r.sla_days == null) continue;
            slaMap.set(`${r.product_id}:${r.stage_key}`, Number(r.sla_days));
          }
        }

        // preferências (opt-out) por owner
        const ownerIds = Array.from(
          new Set(
            rows
              .map((r) =>
                Array.isArray(r.products) ? r.products[0]?.owner_id : r.products?.owner_id,
              )
              .filter((x): x is string => !!x),
          ),
        );
        const prefs = new Map<string, { muted: boolean; push: boolean }>();
        if (ownerIds.length > 0) {
          const { data: prefRows } = await supabaseAdmin
            .from("notification_preferences")
            .select("user_id, muted, push_enabled")
            .eq("category", "pcp")
            .in("user_id", ownerIds);
          for (const p of prefRows ?? []) {
            prefs.set(p.user_id as string, {
              muted: !!p.muted,
              push: (p as { push_enabled: boolean | null }).push_enabled !== false,
            });
          }
        }

        let sent = 0;
        let skipped = 0;
        let evaluated = 0;
        for (const r of rows) {
          if (!r.product_id) continue;
          const sla = slaMap.get(`${r.product_id}:${r.stage}`);
          if (!sla) continue;
          const ref = r.stage_updated_at ?? r.created_at;
          if (!ref) continue;
          const dwellDays = (now - new Date(ref).getTime()) / 86400000;
          evaluated++;
          if (dwellDays <= sla) continue;

          const owner = Array.isArray(r.products) ? r.products[0]?.owner_id : r.products?.owner_id;
          if (!owner) continue;
          const pref = prefs.get(owner);
          if (pref && (pref.muted || !pref.push)) {
            skipped++;
            continue;
          }

          const { data: dupe } = await supabaseAdmin
            .from("push_notifications")
            .select("id")
            .eq("owner_id", owner)
            .eq("kind", "production_sla_breach")
            .contains("payload", { order_id: r.id, stage: r.stage })
            .gte("created_at", dedupeSince)
            .limit(1);
          if (dupe && dupe.length > 0) continue;

          const productName = Array.isArray(r.products) ? r.products[0]?.name : r.products?.name;
          const severity = dwellDays > sla * 2 ? "alta" : "media";
          const dwellRounded = Math.round(dwellDays * 10) / 10;

          await supabaseAdmin.from("push_notifications").insert({
            owner_id: owner,
            kind: "production_sla_breach",
            severity,
            title: `Lote ${r.code ?? r.id.slice(0, 8)} estourou SLA em ${r.stage}`,
            body: `${productName ?? "Produto"} · ${dwellRounded}d parado (SLA ${sla}d)`,
            link: `/lote/${r.id}`,
            payload: {
              order_id: r.id,
              product_id: r.product_id,
              stage: r.stage,
              dwell_days: dwellRounded,
              sla_days: sla,
            },
          });
          sent++;
        }

        return Response.json({
          ok: true,
          candidates: rows.length,
          evaluated,
          sent,
          skipped,
        });
      },
    },
  },
});
