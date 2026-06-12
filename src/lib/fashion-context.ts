import { supabase } from "@/integrations/supabase/client";

export type FashionContext = {
  products: { total: number; byStatus: Record<string, number>; topMargin: Array<{ name: string; sku: string; margin: number; sellPrice: number }> };
  orders: { total: number; revenue: number; byStatus: Record<string, number> };
  finance: { receivablePending: number; payablePending: number; balance: number };
  inventory: { total: number; critical: number };
  collections: { total: number; latest: Array<{ name: string; season: string; year: number }> };
};

export async function buildFashionContext(): Promise<FashionContext> {
  const [prodRes, ordRes, finRes, invRes, colRes] = await Promise.all([
    supabase.from("products").select("name, sku, status, cost_price, sell_price"),
    supabase.from("b2b_orders").select("status, total_value"),
    supabase.from("financial_accounts").select("type, status, value"),
    supabase.from("inventory_items").select("balance, minimum"),
    supabase.from("collections").select("name, season, year").order("created_at", { ascending: false }).limit(5),
  ]);

  const products = prodRes.data ?? [];
  const byStatusP: Record<string, number> = {};
  for (const p of products) byStatusP[p.status] = (byStatusP[p.status] ?? 0) + 1;
  const topMargin = [...products]
    .map((p) => ({ name: p.name, sku: p.sku, sellPrice: Number(p.sell_price), margin: Number(p.sell_price) - Number(p.cost_price) }))
    .sort((a, b) => b.margin - a.margin).slice(0, 5);

  const orders = ordRes.data ?? [];
  const byStatusO: Record<string, number> = {};
  let revenue = 0;
  for (const o of orders) { byStatusO[o.status] = (byStatusO[o.status] ?? 0) + 1; revenue += Number(o.total_value || 0); }

  const fin = finRes.data ?? [];
  let receivable = 0, payable = 0;
  for (const a of fin) {
    if (a.status !== "pendente") continue;
    if (a.type === "receber") receivable += Number(a.value || 0);
    else payable += Number(a.value || 0);
  }

  const inv = invRes.data ?? [];
  const critical = inv.filter((i) => Number(i.balance) <= Number(i.minimum)).length;

  return {
    products: { total: products.length, byStatus: byStatusP, topMargin },
    orders: { total: orders.length, revenue, byStatus: byStatusO },
    finance: { receivablePending: receivable, payablePending: payable, balance: receivable - payable },
    inventory: { total: inv.length, critical },
    collections: { total: (colRes.data ?? []).length, latest: (colRes.data ?? []).map((c) => ({ name: c.name, season: c.season, year: c.year })) },
  };
}
