import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, Layers } from "lucide-react";

export const Route = createFileRoute("/_app/profitability")({ component: Profitability });

type Product = { id: string; sku: string; name: string; collection_id: string | null; cost_price: number | null; sell_price: number | null };
type Collection = { id: string; name: string };
type Sale = { product_id: string | null; quantity: number; total: number };
type Campaign = { collection_id: string | null; investment: number | null };

async function load() {
  const [{ data: products }, { data: collections }, { data: sales }, { data: campaigns }] = await Promise.all([
    supabase.from("products").select("id, sku, name, collection_id, cost_price, sell_price"),
    supabase.from("collections").select("id, name"),
    supabase.from("sales").select("product_id, quantity, total"),
    supabase.from("marketing_campaigns").select("collection_id, investment"),
  ]);
  return {
    products: (products ?? []) as Product[],
    collections: (collections ?? []) as Collection[],
    sales: (sales ?? []) as Sale[],
    campaigns: (campaigns ?? []) as Campaign[],
  };
}

function Profitability() {
  const { data, isLoading } = useQuery({ queryKey: ["profitability"], queryFn: load });
  const products = data?.products ?? [];
  const collections = data?.collections ?? [];
  const sales = data?.sales ?? [];
  const campaigns = data?.campaigns ?? [];

  const byCollection = useMemo(() => {
    return collections.map((c) => {
      const cps = products.filter((p) => p.collection_id === c.id);
      const skuIds = new Set(cps.map((p) => p.id));
      const cs = sales.filter((s) => s.product_id && skuIds.has(s.product_id));
      const revenue = cs.reduce((s, x) => s + Number(x.total), 0);
      const cogs = cs.reduce((s, x) => {
        const p = cps.find((pp) => pp.id === x.product_id);
        return s + (Number(p?.cost_price ?? 0) * x.quantity);
      }, 0);
      const mkt = campaigns.filter((k) => k.collection_id === c.id).reduce((s, k) => s + Number(k.investment ?? 0), 0);
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - mkt;
      const roi = (cogs + mkt) > 0 ? (netProfit / (cogs + mkt)) * 100 : 0;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      return { ...c, revenue, cogs, mkt, grossProfit, netProfit, roi, margin, skus: cps.length };
    }).sort((a, b) => b.netProfit - a.netProfit);
  }, [collections, products, sales, campaigns]);

  const summary = useMemo(() => {
    const revenue = byCollection.reduce((s, c) => s + c.revenue, 0);
    const cogs = byCollection.reduce((s, c) => s + c.cogs, 0);
    const mkt = byCollection.reduce((s, c) => s + c.mkt, 0);
    const net = revenue - cogs - mkt;
    return { revenue, cogs, mkt, net, roi: (cogs + mkt) > 0 ? (net / (cogs + mkt)) * 100 : 0 };
  }, [byCollection]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Motor de Rentabilidade</h1>
        <p className="text-sm text-muted-foreground">Lucro real por coleção: receita − CMV − marketing.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Receita" value={`R$ ${summary.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<Wallet className="size-4" />} tone="primary" />
        <KPI label="CMV + Marketing" value={`R$ ${(summary.cogs + summary.mkt).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<TrendingDown className="size-4" />} />
        <KPI label="Lucro líquido" value={`R$ ${summary.net.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<TrendingUp className="size-4" />} tone={summary.net >= 0 ? "success" : "destructive"} />
        <KPI label="ROI global" value={`${summary.roi.toFixed(0)}%`} icon={<Layers className="size-4" />} tone={summary.roi >= 0 ? "success" : "destructive"} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium">Rentabilidade por coleção</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Coleção</th>
              <th className="text-right px-3 py-2">SKUs</th>
              <th className="text-right px-3 py-2">Receita</th>
              <th className="text-right px-3 py-2">CMV</th>
              <th className="text-right px-3 py-2">Marketing</th>
              <th className="text-right px-3 py-2">Lucro líq.</th>
              <th className="text-right px-3 py-2">Margem</th>
              <th className="text-right px-3 py-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando…</td></tr> :
              byCollection.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sem coleções.</td></tr> :
              byCollection.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.skus}</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {c.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">R$ {c.cogs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">R$ {c.mkt.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${c.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>R$ {c.netProfit.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.margin.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.roi.toFixed(0)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" | "success" | "destructive" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
