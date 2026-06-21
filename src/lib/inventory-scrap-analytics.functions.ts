import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScrapByOpRow = {
  production_order_id: string;
  order_code: string;
  product_name: string | null;
  product_sku: string | null;
  scrap_qty: number;
  scrap_cost: number;
  order_quantity: number;
  scrap_pct: number;
  top_reason: string | null;
  reason: string;
};

/**
 * % de sucata por OP nos últimos 90 dias.
 * scrap_pct = sucata_qty / order.quantity (quando quantity > 0).
 * Ordenado pelo maior % de sucata.
 */
export const getScrapByOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScrapByOpRow[]> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const { data: scraps, error } = await supabase
      .from("inventory_scraps")
      .select("production_order_id, quantity, cost_value, reason, created_at")
      .eq("owner_id", userId)
      .gte("created_at", since)
      .not("production_order_id", "is", null);
    if (error) throw error;

    const opIds = Array.from(
      new Set((scraps ?? []).map((s) => s.production_order_id as string)),
    );
    if (opIds.length === 0) return [];

    const { data: ops } = await supabase
      .from("production_orders")
      .select("id, code, quantity, product_id, products(name, sku)")
      .in("id", opIds);

    type OpRow = {
      id: string;
      code: string;
      quantity: number | null;
      products: { name: string | null; sku: string | null } | null;
    };
    const opMap = new Map<string, OpRow>(((ops ?? []) as OpRow[]).map((o) => [o.id, o]));

    const agg = new Map<
      string,
      { qty: number; cost: number; reasons: Map<string, number> }
    >();
    for (const s of scraps ?? []) {
      const id = s.production_order_id as string;
      const a = agg.get(id) ?? { qty: 0, cost: 0, reasons: new Map<string, number>() };
      a.qty += Number(s.quantity ?? 0);
      a.cost += Number(s.cost_value ?? 0);
      const r = (s.reason ?? "sem motivo") as string;
      a.reasons.set(r, (a.reasons.get(r) ?? 0) + Number(s.quantity ?? 0));
      agg.set(id, a);
    }

    const rows: ScrapByOpRow[] = [];
    for (const [id, a] of agg.entries()) {
      const op = opMap.get(id);
      if (!op) continue;
      const orderQty = Number(op.quantity ?? 0);
      const pct = orderQty > 0 ? (a.qty / orderQty) * 100 : 0;
      let topReason: string | null = null;
      let topQty = 0;
      for (const [r, q] of a.reasons.entries()) {
        if (q > topQty) {
          topReason = r;
          topQty = q;
        }
      }
      const reasonParts: string[] = [];
      if (pct >= 5) reasonParts.push(`sucata acima do limite (5%)`);
      if (topReason) reasonParts.push(`principal: "${topReason}" (${topQty})`);
      if (a.cost > 0) reasonParts.push(`R$ ${a.cost.toFixed(2)} perdidos`);

      rows.push({
        production_order_id: id,
        order_code: op.code,
        product_name: op.products?.name ?? null,
        product_sku: op.products?.sku ?? null,
        scrap_qty: a.qty,
        scrap_cost: Math.round(a.cost * 100) / 100,
        order_quantity: orderQty,
        scrap_pct: Math.round(pct * 10) / 10,
        top_reason: topReason,
        reason:
          reasonParts.length > 0 ? reasonParts.join(" · ") : `${a.qty} unidades sucateadas`,
      });
    }

    rows.sort((x, y) => y.scrap_pct - x.scrap_pct);
    return rows.slice(0, 20);
  });
