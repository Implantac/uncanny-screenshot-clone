import { supabase } from "@/integrations/supabase/client";

export type FashionContext = {
  products: {
    total: number;
    byStatus: Record<string, number>;
    byGroup: Record<string, number>;
    topMargin: Array<{ name: string; sku: string; margin: number; sellPrice: number }>;
  };
  orders: { total: number; revenue: number; byStatus: Record<string, number> };
  finance: { receivablePending: number; payablePending: number; balance: number };
  inventory: {
    total: number;
    critical: number;
    criticalItems: Array<{ name: string; sku: string; balance: number; minimum: number }>;
  };
  production: {
    total: number;
    byStage: Record<string, number>;
    inProgress: Array<{ product: string; stage: string; quantity: number; due?: string }>;
  };
  sales: { last7d: number; last30d: number; last90d: number; topProducts: Array<{ product: string; qty: number }> };
  influencers: { total: number; top: Array<{ name: string; followers: number; engagement: number }> };
  marketing: { active: number; byChannel: Record<string, number> };
  collections: { total: number; latest: Array<{ name: string; season: string; year: number }> };
};

const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

export async function buildFashionContext(): Promise<FashionContext> {
  const [prodRes, ordRes, finRes, invRes, colRes, prodOrdRes, salesRes, infRes, mktRes] = await Promise.all([
    supabase.from("products").select("name, sku, status, product_group, cost_price, sell_price"),
    supabase.from("b2b_orders").select("status, total_value"),
    supabase.from("financial_accounts").select("type, status, value"),
    supabase.from("inventory_items").select("name, sku, balance, minimum"),
    supabase.from("collections").select("name, season, year").order("created_at", { ascending: false }).limit(5),
    supabase.from("production_orders").select("product_name, stage, quantity, due_date").limit(200),
    supabase.from("sales").select("product_name, quantity, total_value, sold_at").gte("sold_at", daysAgo(90)),
    supabase.from("influencers").select("name, followers, engagement_rate").order("followers", { ascending: false }).limit(5),
    supabase.from("marketing_campaigns").select("status, channel"),
  ]);

  const products = prodRes.data ?? [];
  const byStatusP: Record<string, number> = {};
  const byGroupP: Record<string, number> = {};
  for (const p of products) {
    byStatusP[p.status] = (byStatusP[p.status] ?? 0) + 1;
    const g = (p as any).product_group ?? "Sem grupo";
    byGroupP[g] = (byGroupP[g] ?? 0) + 1;
  }
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
  const criticalList = inv.filter((i) => Number(i.balance) <= Number(i.minimum));
  const criticalItems = criticalList.slice(0, 8).map((i) => ({ name: i.name, sku: i.sku, balance: Number(i.balance), minimum: Number(i.minimum) }));

  const po = prodOrdRes.data ?? [];
  const byStage: Record<string, number> = {};
  for (const p of po) byStage[(p as any).stage ?? "—"] = (byStage[(p as any).stage ?? "—"] ?? 0) + Number((p as any).quantity ?? 0);
  const inProgress = po
    .filter((p: any) => !["concluido", "concluído", "cancelado"].includes((p.stage ?? "").toLowerCase()))
    .slice(0, 8)
    .map((p: any) => ({ product: p.product_name, stage: p.stage, quantity: Number(p.quantity ?? 0), due: p.due_date ?? undefined }));

  const sales = salesRes.data ?? [];
  const now = Date.now();
  const sum = (days: number) => sales.filter((s: any) => now - new Date(s.sold_at).getTime() <= days * 86400_000)
    .reduce((acc: number, s: any) => acc + Number(s.quantity ?? 0), 0);
  const topMap: Record<string, number> = {};
  for (const s of sales as any[]) topMap[s.product_name] = (topMap[s.product_name] ?? 0) + Number(s.quantity ?? 0);
  const topProducts = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([product, qty]) => ({ product, qty }));

  const inf = infRes.data ?? [];
  const mkt = mktRes.data ?? [];
  const byChannel: Record<string, number> = {};
  for (const c of mkt as any[]) byChannel[c.channel ?? "—"] = (byChannel[c.channel ?? "—"] ?? 0) + 1;

  return {
    products: { total: products.length, byStatus: byStatusP, byGroup: byGroupP, topMargin },
    orders: { total: orders.length, revenue, byStatus: byStatusO },
    finance: { receivablePending: receivable, payablePending: payable, balance: receivable - payable },
    inventory: { total: inv.length, critical: criticalList.length, criticalItems },
    production: { total: po.length, byStage, inProgress },
    sales: { last7d: sum(7), last30d: sum(30), last90d: sum(90), topProducts },
    influencers: { total: inf.length, top: (inf as any[]).map((i) => ({ name: i.name, followers: Number(i.followers ?? 0), engagement: Number(i.engagement_rate ?? 0) })) },
    marketing: { active: (mkt as any[]).filter((c) => c.status === "ativa").length, byChannel },
    collections: { total: (colRes.data ?? []).length, latest: (colRes.data ?? []).map((c) => ({ name: c.name, season: c.season, year: c.year })) },
  };
}
