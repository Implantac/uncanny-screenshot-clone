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

const UploadMeta = z.object({
  attachment_kind: z.enum(["document", "sample", "photo", "invoice", "other"]).default("document"),
  sample_status: z
    .enum(["received", "pending_review", "approved", "rejected", "needs_adjustment"])
    .default("received"),
  notes: z.string().max(2000).optional().nullable(),
  checklist: z
    .object({
      measurements: z.boolean().optional(),
      finishing: z.boolean().optional(),
      color: z.boolean().optional(),
      fabric: z.boolean().optional(),
      packaging: z.boolean().optional(),
    })
    .default({}),
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
          .select(
            "id, file_name, file_path, mime, size, rfq_id, production_order_id, attachment_kind, sample_status, checklist, notes, created_at",
          )
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

        return Response.json({
          supplier,
          rfqs: rfqs ?? [],
          quotes: myQuotes ?? [],
          production_orders: pos ?? [],
          attachments: attachments ?? [],
          acks: acks ?? [],
        });
      },
      // POST: submit/update a quote OR ?action=ack | ?action=upload (multipart)
      POST: async ({ request, params }) => {
        const token = params.token;
        if (!token || token.length < 16) return new Response("Invalid token", { status: 400 });
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokRow } = await supabaseAdmin
          .from("supplier_portal_tokens")
          .select("owner_id, supplier_id, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (!tokRow) return new Response("Not found", { status: 404 });
        if (tokRow.expires_at && new Date(tokRow.expires_at) < new Date())
          return new Response("Expired", { status: 410 });

        // === ACK: aceitar/recusar/contraproposta de OP ===
        if (action === "ack") {
          const body = await request.json().catch(() => null);
          const Ack = z.object({
            production_order_id: z.string().uuid(),
            decision: z.enum(["accepted", "declined", "counter"]),
            counter_due_date: z.string().optional().nullable(),
            notes: z.string().max(2000).optional().nullable(),
          });
          const p = Ack.safeParse(body);
          if (!p.success) return Response.json({ error: p.error.flatten() }, { status: 400 });
          const { data: po } = await supabaseAdmin
            .from("production_orders")
            .select("id, owner_id, supplier_id")
            .eq("id", p.data.production_order_id)
            .single();
          if (!po || po.owner_id !== tokRow.owner_id || po.supplier_id !== tokRow.supplier_id)
            return new Response("Forbidden", { status: 403 });
          await supabaseAdmin.from("supplier_portal_acks").insert({
            owner_id: tokRow.owner_id,
            supplier_id: tokRow.supplier_id,
            production_order_id: p.data.production_order_id,
            decision: p.data.decision,
            counter_due_date: p.data.counter_due_date || null,
            notes: p.data.notes || null,
          });
          log("info", "supplier_portal.ack", {
            production_order_id: p.data.production_order_id,
            decision: p.data.decision,
          });
          return Response.json({ ok: true });
        }

        // === UPLOAD multipart ===
        if (action === "upload") {
          const form = await request.formData().catch(() => null);
          if (!form) return new Response("Invalid form", { status: 400 });
          const file = form.get("file");
          const rfqId = (form.get("rfq_id") as string) || null;
          const orderId = (form.get("production_order_id") as string) || null;
          if (!(file instanceof File)) return new Response("file missing", { status: 400 });
          const meta = UploadMeta.safeParse({
            attachment_kind: (form.get("attachment_kind") as string) || "document",
            sample_status: (form.get("sample_status") as string) || "received",
            notes: (form.get("notes") as string) || null,
            checklist: {
              measurements: form.get("check_measurements") === "true",
              finishing: form.get("check_finishing") === "true",
              color: form.get("check_color") === "true",
              fabric: form.get("check_fabric") === "true",
              packaging: form.get("check_packaging") === "true",
            },
          });
          if (!meta.success) return Response.json({ error: meta.error.flatten() }, { status: 400 });
          if (file.size > 20 * 1024 * 1024) return new Response("Max 20MB", { status: 413 });
          if (!rfqId && !orderId) return new Response("target missing", { status: 400 });
          if (rfqId) {
            const { data: rfq } = await supabaseAdmin
              .from("rfq_requests")
              .select("id, owner_id, status")
              .eq("id", rfqId)
              .single();
            if (!rfq || rfq.owner_id !== tokRow.owner_id)
              return new Response("Forbidden", { status: 403 });
            if (!["aberta", "cotando"].includes(rfq.status))
              return new Response("RFQ closed", { status: 409 });
          }
          if (orderId) {
            const { data: po } = await supabaseAdmin
              .from("production_orders")
              .select("id, owner_id, supplier_id")
              .eq("id", orderId)
              .single();
            if (!po || po.owner_id !== tokRow.owner_id || po.supplier_id !== tokRow.supplier_id)
              return new Response("Forbidden", { status: 403 });
          }
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
          const path = `${tokRow.owner_id}/${tokRow.supplier_id}/${Date.now()}_${safe}`;
          const buf = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from("supplier-uploads")
            .upload(path, buf, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
          if (upErr) return new Response(upErr.message, { status: 500 });
          await supabaseAdmin.from("supplier_portal_attachments").insert({
            owner_id: tokRow.owner_id,
            supplier_id: tokRow.supplier_id,
            rfq_id: rfqId,
            production_order_id: orderId,
            file_path: path,
            file_name: file.name,
            mime: file.type || null,
            size: file.size,
            uploaded_via: "portal",
            attachment_kind: meta.data.attachment_kind,
            sample_status: meta.data.sample_status,
            checklist: meta.data.checklist,
            notes: meta.data.notes || null,
          });
          log("info", "supplier_portal.upload", {
            supplier_id: tokRow.supplier_id,
            size: file.size,
            attachment_kind: meta.data.attachment_kind,
          });
          return Response.json({ ok: true, path });
        }

        // === QUOTE (default) ===
        const body = await request.json().catch(() => null);
        const parsed = Submit.safeParse(body);
        if (!parsed.success)
          return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        const tok = tokRow;

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
          .from("suppliers")
          .select("name")
          .eq("id", tok.supplier_id)
          .single();

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
        await supabaseAdmin
          .from("rfq_requests")
          .update({ status: "cotando" })
          .eq("id", parsed.data.rfq_id)
          .eq("status", "aberta");

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
