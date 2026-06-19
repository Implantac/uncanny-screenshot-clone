import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Config ----------------------------------------------------------------

export const getErpConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    let { data } = await supabase
      .from("erp_integration_config")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!data) {
      const ins = await supabase
        .from("erp_integration_config")
        .insert({ owner_id: userId, erp_name: "ERP" })
        .select("*")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      data = ins.data;
    }
    return data;
  });

const SaveConfigInput = z.object({
  erp_name: z.string().max(120).optional(),
  erp_endpoint: z.string().url().max(500).optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const saveErpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveConfigInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("erp_integration_config")
      .update({
        erp_name: data.erp_name,
        erp_endpoint: data.erp_endpoint || null,
        active: data.active ?? true,
      })
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateWebhookId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const newId = (globalThis.crypto?.randomUUID?.() ?? "").replace(/-/g, "");
    const { data, error } = await supabase
      .from("erp_integration_config")
      .update({ webhook_public_id: newId })
      .eq("owner_id", userId)
      .select("webhook_public_id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

// ---- Logs ------------------------------------------------------------------

export const getRecentErpSyncs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("erp_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---- Push PLM release to ERP ----------------------------------------------

const PushInput = z.object({ tech_sheet_id: z.string().uuid() });

export const pushPlmRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PushInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ts, error } = await supabase
      .from("tech_sheets")
      .select("id, status, cost_price, product_id, products(id, sku, name, category)")
      .eq("id", data.tech_sheet_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ts || ts.status !== "aprovada") throw new Error("Ficha não está aprovada");

    const { data: cfg } = await supabase
      .from("erp_integration_config")
      .select("erp_endpoint, active")
      .eq("owner_id", userId)
      .maybeSingle();

    const payload = {
      type: "plm.release",
      tech_sheet_id: ts.id,
      product: ts.products,
      cost_price: ts.cost_price,
      released_at: new Date().toISOString(),
    };

    let status: "ok" | "erro" | "ignorado" = "ignorado";
    let errorMessage: string | null = null;
    if (cfg?.active && cfg.erp_endpoint) {
      try {
        const res = await fetch(cfg.erp_endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        status = res.ok ? "ok" : "erro";
        if (!res.ok) errorMessage = `HTTP ${res.status}`;
      } catch (e) {
        status = "erro";
        errorMessage = (e as Error).message;
      }
    }

    await supabase.from("erp_sync_log").insert({
      owner_id: userId,
      direction: "outbound",
      event_type: "plm.release",
      entity_type: "tech_sheet",
      entity_ref: ts.id,
      status,
      records_affected: 1,
      payload,
      error_message: errorMessage,
    });

    if (status === "ok") {
      await supabase
        .from("erp_integration_config")
        .update({ last_outbound_at: new Date().toISOString(), last_error: null })
        .eq("owner_id", userId);
    } else if (status === "erro") {
      await supabase
        .from("erp_integration_config")
        .update({ last_error: errorMessage })
        .eq("owner_id", userId);
    }

    return { status, errorMessage };
  });
