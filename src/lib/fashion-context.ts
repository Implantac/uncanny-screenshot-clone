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
    byStatus: Record<string, number>;
    inProgress: Array<{ code: string; status: string; quantity: number; due?: string }>;
  };
  sales: {
    last7d: number;
    last30d: number;
    last90d: number;
    revenue30d: number;
    topProducts: Array<{ sku: string; qty: number }>;
    byChannel: Record<string, number>;
    byUF: Record<string, number>;
  };
  influencers: {
    total: number;
    top: Array<{ nome: string; seguidores: number; engajamento: number; impacto: number }>;
  };
  marketing: { active: number; byChannel: Record<string, number>; totalInvestment: number };
  collections: { total: number; latest: Array<{ name: string; season: string; year: number }> };
};

const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

export async function buildFashionContext(): Promise<FashionContext> {
  const [prodRes, ordRes, finRes, invRes, colRes, prodOrdRes, salesRes, infRes, mktRes] =
    await Promise.all([
      supabase.from("products").select("name, sku, status, product_group, cost_price, sell_price"),
      supabase.from("b2b_orders").select("status, total_value"),
      supabase.from("financial_accounts").select("type, status, value"),
      supabase.from("inventory_items").select("name, sku, balance, minimum"),
      supabase
        .from("collections")
        .select("name, season, year")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("production_orders").select("code, status, quantity, due_date").limit(200),
      supabase
        .from("sales")
        .select("sku, channel, uf, quantity, total, sold_at")
        .gte("sold_at", daysAgo(90)),
      supabase
        .from("influencers")
        .select("nome, seguidores, engajamento, vendas_antes, vendas_depois")
        .order("seguidores", { ascending: false })
        .limit(5),
      supabase.from("marketing_campaigns").select("status, channel, investment"),
    ]);

  const products = prodRes.data ?? [];
  const byStatusP: Record<string, number> = {};
  const byGroupP: Record<string, number> = {};
  for (const p of products) {
    byStatusP[p.status] = (byStatusP[p.status] ?? 0) + 1;
    const g = (p as { product_group?: string | null }).product_group ?? "Sem grupo";
    byGroupP[g] = (byGroupP[g] ?? 0) + 1;
  }
  const topMargin = [...products]
    .map((p) => ({
      name: p.name,
      sku: p.sku,
      sellPrice: Number(p.sell_price),
      margin: Number(p.sell_price) - Number(p.cost_price),
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  const orders = ordRes.data ?? [];
  const byStatusO: Record<string, number> = {};
  let revenue = 0;
  for (const o of orders) {
    byStatusO[o.status] = (byStatusO[o.status] ?? 0) + 1;
    revenue += Number(o.total_value || 0);
  }

  const fin = finRes.data ?? [];
  let receivable = 0,
    payable = 0;
  for (const a of fin) {
    if (a.status !== "pendente") continue;
    if (a.type === "receber") receivable += Number(a.value || 0);
    else payable += Number(a.value || 0);
  }

  const inv = invRes.data ?? [];
  const criticalList = inv.filter((i) => Number(i.balance) <= Number(i.minimum));
  const criticalItems = criticalList.slice(0, 8).map((i) => ({
    name: i.name,
    sku: i.sku,
    balance: Number(i.balance),
    minimum: Number(i.minimum),
  }));

  type PoRow = { code: string; status: string | null; quantity: number | null; due_date: string | null };
  const po = (prodOrdRes.data ?? []) as PoRow[];
  const byStatusPO: Record<string, number> = {};
  for (const p of po)
    byStatusPO[p.status ?? "—"] = (byStatusPO[p.status ?? "—"] ?? 0) + Number(p.quantity ?? 0);
  const inProgress = po
    .filter(
      (p) => !["concluido", "concluído", "cancelado"].includes((p.status ?? "").toLowerCase()),
    )
    .slice(0, 8)
    .map((p) => ({
      code: p.code,
      status: p.status,
      quantity: Number(p.quantity ?? 0),
      due: p.due_date ?? undefined,
    }));

  type SaleRow = { sku: string; channel: string | null; uf: string | null; quantity: number | null; total: number | null; sold_at: string };
  const sales = (salesRes.data ?? []) as SaleRow[];
  const now = Date.now();
  const within = (days: number) =>
    sales.filter((s) => now - new Date(s.sold_at).getTime() <= days * 86400_000);
  const sumQty = (days: number) =>
    within(days).reduce((acc, s) => acc + Number(s.quantity ?? 0), 0);
  const revenue30d = within(30).reduce((acc, s) => acc + Number(s.total ?? 0), 0);
  const topMap: Record<string, number> = {};
  const chanMap: Record<string, number> = {};
  const ufMap: Record<string, number> = {};
  for (const s of sales) {
    topMap[s.sku] = (topMap[s.sku] ?? 0) + Number(s.quantity ?? 0);
    if (s.channel) chanMap[s.channel] = (chanMap[s.channel] ?? 0) + Number(s.quantity ?? 0);
    if (s.uf) ufMap[s.uf] = (ufMap[s.uf] ?? 0) + Number(s.quantity ?? 0);
  }
  const topProducts = Object.entries(topMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sku, qty]) => ({ sku, qty }));

  type InfRow = { nome: string; seguidores: number | null; engajamento: number | null; vendas_antes: number | null; vendas_depois: number | null };
  type MktRow = { status: string; channel: string | null; investment: number | null };
  const inf = (infRes.data ?? []) as InfRow[];
  const mkt = (mktRes.data ?? []) as MktRow[];
  const byChannelM: Record<string, number> = {};
  let totalInvestment = 0;
  for (const c of mkt) {
    byChannelM[c.channel ?? "—"] = (byChannelM[c.channel ?? "—"] ?? 0) + 1;
    totalInvestment += Number(c.investment ?? 0);
  }

  return {
    products: { total: products.length, byStatus: byStatusP, byGroup: byGroupP, topMargin },
    orders: { total: orders.length, revenue, byStatus: byStatusO },
    finance: {
      receivablePending: receivable,
      payablePending: payable,
      balance: receivable - payable,
    },
    inventory: { total: inv.length, critical: criticalList.length, criticalItems },
    production: { total: po.length, byStatus: byStatusPO, inProgress },
    sales: {
      last7d: sumQty(7),
      last30d: sumQty(30),
      last90d: sumQty(90),
      revenue30d,
      topProducts,
      byChannel: chanMap,
      byUF: ufMap,
    },
    influencers: {
      total: inf.length,
      top: inf.map((i) => {
        const antes = Number(i.vendas_antes ?? 0);
        const depois = Number(i.vendas_depois ?? 0);
        const impacto = antes > 0 ? ((depois - antes) / antes) * 100 : depois > 0 ? 100 : 0;
        return {
          nome: i.nome,
          seguidores: Number(i.seguidores ?? 0),
          engajamento: Number(i.engajamento ?? 0),
          impacto,
        };
      }),
    },
    marketing: {
      active: mkt.filter((c) => c.status === "ativa").length,
      byChannel: byChannelM,
      totalInvestment,
    },
    collections: {
      total: (colRes.data ?? []).length,
      latest: (colRes.data ?? []).map((c) => ({ name: c.name, season: c.season, year: c.year })),
    },
  };
}
