import { supabase } from "@/integrations/supabase/client";
import type { ErpSale, ErpInventory, ErpPurchase } from "./types";

export async function fetchErpSales(opts?: {
  from?: string;
  to?: string;
  influencerCode?: string;
  limit?: number;
}) {
  let q = supabase
    .from("erp_sales_mirror")
    .select("*")
    .order("sold_at", { ascending: false })
    .limit(opts?.limit ?? 500);
  if (opts?.from) q = q.gte("sold_at", opts.from);
  if (opts?.to) q = q.lte("sold_at", opts.to);
  if (opts?.influencerCode) q = q.eq("influencer_code", opts.influencerCode);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ErpSale[];
}

export async function fetchErpInventory(sku?: string) {
  let q = supabase
    .from("erp_inventory_mirror")
    .select("*")
    .order("synced_at", { ascending: false })
    .limit(1000);
  if (sku) q = q.eq("sku", sku);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ErpInventory[];
}

export async function fetchErpPurchases(limit = 500) {
  const { data, error } = await supabase
    .from("erp_purchase_mirror")
    .select("*")
    .order("ordered_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ErpPurchase[];
}

export function aggregateSalesByInfluencer(sales: ErpSale[]) {
  const map = new Map<
    string,
    { code: string; orders: number; quantity: number; revenue: number }
  >();
  for (const s of sales) {
    if (!s.influencer_code) continue;
    const cur = map.get(s.influencer_code) ?? {
      code: s.influencer_code,
      orders: 0,
      quantity: 0,
      revenue: 0,
    };
    cur.orders += 1;
    cur.quantity += Number(s.quantity ?? 0);
    cur.revenue += Number(s.total_value ?? 0);
    map.set(s.influencer_code, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function aggregateSalesByRegion(sales: ErpSale[]) {
  const map = new Map<string, { region: string; orders: number; revenue: number }>();
  for (const s of sales) {
    const key = s.region ?? "—";
    const cur = map.get(key) ?? { region: key, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(s.total_value ?? 0);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function aggregateSalesByCampaign(sales: ErpSale[]) {
  const map = new Map<string, { code: string; orders: number; revenue: number }>();
  for (const s of sales) {
    if (!s.campaign_code) continue;
    const cur = map.get(s.campaign_code) ?? { code: s.campaign_code, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(s.total_value ?? 0);
    map.set(s.campaign_code, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}
