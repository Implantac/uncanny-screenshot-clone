import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

// Webhook ERP → PLM: o ERP envia eventos de vendas, compras e estoque.
// Segurança: HMAC SHA-256 do corpo cru, com chave ERP_WEBHOOK_SECRET, no header `x-erp-signature`.
// O caller identifica o tenant via `publicId` no path (vinculado a um owner em erp_integration_config).

const EventSchema = z.object({
  type: z.enum(["sale", "purchase", "inventory"]),
  data: z.record(z.string(), z.unknown()),
});

const PayloadSchema = z.object({
  events: z.array(EventSchema).min(1).max(500),
});

function verifySignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length) return false;
  return timingSafeEqual(sig, exp);
}

export const Route = createFileRoute("/api/public/erp-sync/$publicId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const secret = process.env.ERP_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Missing webhook secret", { status: 500 });
        }

        const body = await request.text();
        const signature = request.headers.get("x-erp-signature");
        if (!verifySignature(body, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof PayloadSchema>;
        try {
          parsed = PayloadSchema.parse(JSON.parse(body));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: cfg } = await supabaseAdmin
          .from("erp_integration_config")
          .select("owner_id, active")
          .eq("webhook_public_id", params.publicId)
          .maybeSingle();
        if (!cfg || !cfg.active) {
          return new Response("Unknown tenant", { status: 404 });
        }

        const ownerId = cfg.owner_id;
        let salesIns = 0,
          purchasesIns = 0,
          invIns = 0;
        const errors: string[] = [];

        for (const ev of parsed.events) {
          try {
            if (ev.type === "sale") {
              const d = ev.data as Record<string, unknown>;
              const { error } = await supabaseAdmin.from("erp_sales_mirror").insert({
                owner_id: ownerId,
                erp_sale_id: String(d.erp_sale_id ?? d.id ?? crypto.randomUUID()),
                sku: (d.sku as string) ?? null,
                product_ref: (d.product_ref as string) ?? null,
                quantity: Number(d.quantity ?? 0),
                total_value: Number(d.total_value ?? 0),
                customer: (d.customer as string) ?? null,
                region: (d.region as string) ?? null,
                channel: (d.channel as string) ?? null,
                sold_at: (d.sold_at as string) ?? null,
                influencer_code: (d.influencer_code as string) ?? null,
                campaign_code: (d.campaign_code as string) ?? null,
              });
              if (error) throw error;
              salesIns++;
            } else if (ev.type === "purchase") {
              const d = ev.data as Record<string, unknown>;
              const { error } = await supabaseAdmin.from("erp_purchase_mirror").insert({
                owner_id: ownerId,
                erp_po_code: String(d.erp_po_code ?? d.code ?? crypto.randomUUID()),
                supplier: (d.supplier as string) ?? null,
                total_value: Number(d.total_value ?? 0),
                status: (d.status as string) ?? null,
                ordered_at: (d.ordered_at as string) ?? null,
              });
              if (error) throw error;
              purchasesIns++;
            } else if (ev.type === "inventory") {
              const d = ev.data as Record<string, unknown>;
              const { error } = await supabaseAdmin.from("erp_inventory_mirror").insert({
                owner_id: ownerId,
                sku: String(d.sku),
                balance: Number(d.balance ?? 0),
                location: (d.location as string) ?? null,
                erp_updated_at: (d.erp_updated_at as string) ?? null,
                synced_at: new Date().toISOString(),
              });
              if (error) throw error;
              invIns++;
            }
          } catch (e) {
            errors.push((e as Error).message);
          }
        }

        const totalOk = salesIns + purchasesIns + invIns;
        await supabaseAdmin.from("erp_sync_log").insert({
          owner_id: ownerId,
          direction: "inbound",
          event_type: "batch",
          entity_type: "mixed",
          status: errors.length ? (totalOk ? "ok" : "erro") : "ok",
          records_affected: totalOk,
          payload: {
            sales: salesIns,
            purchases: purchasesIns,
            inventory: invIns,
            error_count: errors.length,
          },
          error_message: errors.slice(0, 5).join(" | ") || null,
        });

        await supabaseAdmin
          .from("erp_integration_config")
          .update({
            last_inbound_at: new Date().toISOString(),
            last_error: errors.length ? errors[0] : null,
          })
          .eq("owner_id", ownerId);

        return new Response(
          JSON.stringify({
            ok: true,
            sales: salesIns,
            purchases: purchasesIns,
            inventory: invIns,
            errors: errors.length,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
