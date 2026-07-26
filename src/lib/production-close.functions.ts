import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fecha uma OP no PLM (não faz movimento de estoque de acabado — isso é do ERP).
 * - Marca status='concluida', stage='entregue', progress=100
 * - Registra produced_qty / rejected_qty / notes / closed_at / closed_by
 * - Libera reservas de material ainda 'ativa' (status → 'liberada')
 * - Registra passagem final no production_stage_log
 */
const Input = z.object({
  orderId: z.string().uuid(),
  producedQty: z.number().min(0),
  rejectedQty: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
});

export const closeProductionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cur, error: e0 } = await supabase
      .from("production_orders")
      .select("id, owner_id, stage, quantity, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!cur || cur.owner_id !== userId) throw new Error("OP não encontrada.");
    if (cur.status === "concluida") throw new Error("OP já está fechada.");

    const now = new Date().toISOString();

    const { error: e1 } = await supabase
      .from("production_orders")
      .update({
        status: "concluida",
        stage: "entregue",
        progress: 100,
        closed_at: now,
        closed_by: userId,
        produced_qty: data.producedQty,
        rejected_qty: data.rejectedQty,
        close_notes: data.notes ?? null,
        stage_updated_at: now,
      } as never)
      .eq("id", data.orderId)
      .eq("owner_id", userId);
    if (e1) throw new Error(e1.message);

    // Liberar reservas ativas remanescentes
    const { data: released } = await supabase
      .from("material_reservations")
      .update({ status: "liberada", updated_at: now } as never)
      .eq("production_order_id", data.orderId)
      .eq("status", "ativa")
      .select("id");

    // Log de passagem
    await supabase.from("production_stage_log").insert({
      order_id: data.orderId,
      owner_id: userId,
      from_stage: cur.stage,
      to_stage: "entregue",
      note: `Fechamento — produzido ${data.producedQty}${
        data.rejectedQty ? `, refugo ${data.rejectedQty}` : ""
      }${data.notes ? ` — ${data.notes}` : ""}`,
    } as never);

    // Auditoria (não é ERP: é rastreabilidade PLM)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_logs").insert({
      user_id: userId,
      action: "pcp.op_closed",
      entity: "production_order",
      entity_id: data.orderId,
      payload: {
        produced_qty: data.producedQty,
        rejected_qty: data.rejectedQty,
        planned_qty: cur.quantity,
        released_reservations: released?.length ?? 0,
      },
    });

    return {
      ok: true,
      releasedReservations: released?.length ?? 0,
    };
  });
