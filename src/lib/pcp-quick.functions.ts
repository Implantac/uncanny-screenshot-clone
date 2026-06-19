import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Apontamento rápido de produção parcial.
 * - Atualiza progress (%) e quantidade produzida da OP
 * - Registra linha em production_stage_log como parcial
 */
const ProgressInput = z.object({
  orderId: z.string().uuid(),
  producedQty: z.number().int().min(0).max(1_000_000),
  note: z.string().max(500).optional(),
});

export const setProductionProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProgressInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cur, error: e0 } = await supabase
      .from("production_orders")
      .select("id, owner_id, stage, quantity, progress")
      .eq("id", data.orderId)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!cur || cur.owner_id !== userId) throw new Error("OP não encontrada.");

    const qty = Math.max(1, Number(cur.quantity ?? 0));
    const pct = Math.min(100, Math.max(0, Math.round((data.producedQty / qty) * 100)));

    const { error } = await supabase
      .from("production_orders")
      .update({ progress: pct } as never)
      .eq("id", data.orderId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);

    await supabase.from("production_stage_log").insert({
      order_id: data.orderId,
      owner_id: userId,
      from_stage: cur.stage,
      to_stage: cur.stage,
      quantity: data.producedQty,
      is_partial: true,
      note: data.note ?? `Apontamento parcial: ${data.producedQty}/${qty} pç (${pct}%)`,
    } as never);

    return { ok: true, progress: pct };
  });
