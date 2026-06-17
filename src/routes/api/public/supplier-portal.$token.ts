import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { log } from "@/lib/observability";

const Submit = z.object({
  rfq_id: z.string().uuid(),
  unit_price: z.number().min(0).max(1_000_000),
  lead_time_days: z.number().int().min(0).max(365).default(0),
  moq: z.number().min(0).max(1_000_000).default(0),
  payment_terms: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/supplier-portal/$token")({
  server: {
    handlers: {
      // GET: list RFQs visible to this supplier (same owner)
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 16) return new Response("Invalid token", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tok } = await supabaseAdmin
          .from("supplier_portal_tokens")
          .select("id, owner_id, supplier_id, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (!tok) return new Response("Not found", { status: 404 });
        if (tok.expires_at && new Date(tok.expires_at) < new Date())
          return new Response("Expired", { status: 410 });

        const [{ data: supplier }, { data: rfqs }, { data: pos }] = await Promise.all([
          supabaseAdmin.from("suppliers").select("id, name").eq("id", tok.supplier_id).single(),
          supabaseAdmin
            .from("rfq_requests")
            .select("id, code, title, quantity, unit, needed_by, status")
            .eq("owner_id", tok.owner_id)
            .in("status", ["aberta", "cotando"])
            .order("created_at", { ascending: false })
            .limit(50),
          supabaseAdmin
            .from("production_orders")
            .select("id, code, quantity, due_date, stage, status, products(name, sku)")
            .eq("owner_id", tok.owner_id)
            .eq("supplier_id", tok.supplier_id)
            .neq("status", "cancelada")
            .neq("status", "concluida")
            .order("due_date", { ascending: true })
            .limit(50),
        ]);

        const { data: myQuotes } = await supabaseAdmin
          .from("rfq_quotes")
          .select("id, rfq_id, unit_price, lead_time_days, moq, payment_terms, awarded")
          .eq("supplier_id", tok.supplier_id)
          .eq("owner_id", tok.owner_id);

        await supabaseAdmin
          .from("supplier_portal_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", tok.id);

        const { data: attachments } = await supabaseAdmin
          .from("supplier_portal_attachments")
          .select("id, file_name, file_path, mime, size, rfq_id, production_order_id, created_at")
          .eq("owner_id", tok.owner_id)
          .eq("supplier_id", tok.supplier_id)
          .order("created_at", { ascending: false })
          .limit(100);

        const { data: acks } = await supabaseAdmin
          .from("supplier_portal_acks")
          .select("id, production_order_id, decision, counter_due_date, notes, created_at")
          .eq("owner_id", tok.owner_id)
          .eq("supplier_id", tok.supplier_id)
          .order("created_at", { ascending: false });

        return Response.json({ supplier, rfqs: rfqs ?? [], quotes: myQuotes ?? [], production_orders: pos ?? [], attachments: attachments ?? [], acks: acks ?? [] });
      },
      // POST: submit/update a quote
      POST: async ({ request, params }) => {
        const token = params.token;
        if (!token || token.length < 16) return new Response("Invalid token", { status: 400 });
        const body = await request.json().catch(() => null);
        const parsed = Submit.safeParse(body);
        if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tok } = await supabaseAdmin
          .from("supplier_portal_tokens")
          .select("owner_id, supplier_id, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (!tok) return new Response("Not found", { status: 404 });
        if (tok.expires_at && new Date(tok.expires_at) < new Date())
          return new Response("Expired", { status: 410 });

        // Ensure the RFQ belongs to this owner
        const { data: rfq } = await supabaseAdmin
          .from("rfq_requests")
          .select("id, owner_id, status")
          .eq("id", parsed.data.rfq_id)
          .single();
        if (!rfq || rfq.owner_id !== tok.owner_id)
          return new Response("Forbidden", { status: 403 });
        if (!["aberta", "cotando"].includes(rfq.status))
          return new Response("RFQ closed", { status: 409 });

        const { data: supplier } = await supabaseAdmin
          .from("suppliers").select("name").eq("id", tok.supplier_id).single();

        // Upsert quote per (rfq, supplier)
        const { data: existing } = await supabaseAdmin
          .from("rfq_quotes")
          .select("id")
          .eq("rfq_id", parsed.data.rfq_id)
          .eq("supplier_id", tok.supplier_id)
          .maybeSingle();

        const payload = {
          owner_id: tok.owner_id,
          rfq_id: parsed.data.rfq_id,
          supplier_id: tok.supplier_id,
          supplier_name: supplier?.name ?? null,
          unit_price: parsed.data.unit_price,
          lead_time_days: parsed.data.lead_time_days,
          moq: parsed.data.moq,
          payment_terms: parsed.data.payment_terms ?? null,
          notes: parsed.data.notes ?? null,
        };

        if (existing) {
          await supabaseAdmin.from("rfq_quotes").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("rfq_quotes").insert(payload);
        }
        await supabaseAdmin.from("rfq_requests").update({ status: "cotando" }).eq("id", parsed.data.rfq_id).eq("status", "aberta");

        log("info", "supplier_portal.quote_submitted", {
          rfq_id: parsed.data.rfq_id,
          supplier_id: tok.supplier_id,
          updated: Boolean(existing),
        });
        return Response.json({ ok: true });
      },
    },
  },
});
