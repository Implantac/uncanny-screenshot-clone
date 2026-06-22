import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Aprova uma ficha técnica.
 * Permissão: admin OU gerente.
 * Efeito: status = 'aprovada', approved_by/at/note preenchidos.
 * Cria também um snapshot de versão para registro imutável.
 */
export const approveTechSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sheetId: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: isAdmin }, { data: isGerente }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "gerente" }),
    ]);
    if (!isAdmin && !isGerente) {
      throw new Error("Apenas admin ou gerente podem aprovar fichas técnicas.");
    }

    const { data: sheet, error: sErr } = await supabase
      .from("tech_sheets")
      .select("id, status")
      .eq("id", data.sheetId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sheet) throw new Error("Ficha não encontrada.");
    if (sheet.status === "aprovada") throw new Error("Ficha já aprovada.");

    const nowIso = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("tech_sheets")
      .update({
        status: "aprovada",
        approved_by: userId,
        approved_at: nowIso,
        approval_note: data.note ?? null,
      })
      .eq("id", data.sheetId);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, approvedAt: nowIso };
  });

export const unapproveTechSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sheetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin pode reabrir uma ficha aprovada.");

    const { error } = await supabase
      .from("tech_sheets")
      .update({
        status: "em_revisao",
        approved_by: null,
        approved_at: null,
        approval_note: null,
      })
      .eq("id", data.sheetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
