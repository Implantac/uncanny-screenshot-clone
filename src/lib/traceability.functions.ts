import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Rastreabilidade visual: timeline de uma OP (por código ou batch). */
export const getOrderTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { query: string }) =>
    z.object({ query: z.string().trim().min(2).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = data.query.toUpperCase();

    const { data: orders, error } = await supabase
      .from("production_orders")
      .select(
        "id, code, quantity, stage, status, batch_code, due_date, stage_updated_at, created_at, products(name, sku, image_url), suppliers(name)",
      )
      .eq("owner_id", userId)
      .or(`code.ilike.%${q}%,batch_code.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    if (!orders || orders.length === 0) return { orders: [], events: [] };

    const ids = orders.map((o) => o.id);
    const { data: events, error: e2 } = await supabase
      .from("production_stage_log")
      .select("id, order_id, from_stage, to_stage, quantity, is_partial, note, created_at")
      .in("order_id", ids)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);

    return { orders, events: events ?? [] };
  });
