/**
 * Auditoria leve — registra visualização do Product Workspace em `audit_logs`
 * via a função SQL `log_audit`. Serve como trilha "quem abriu o produto X".
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({ productId: z.string().uuid() });

export const logProductView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Confirma que o produto pertence ao tenant antes de logar
    const { data: p } = await supabase
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!p) return { ok: false };
    const { error } = await supabase.rpc("log_audit", {
      _entity: "product",
      _entity_id: data.productId,
      _action: "workspace_view",
      _payload: null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
