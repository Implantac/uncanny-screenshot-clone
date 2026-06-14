import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Star, DollarSign, Repeat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/product-score")({ component: ProductScore });

type Product = { id: string; sku: string; name: string; category: string | null; cost_price: number | null; sell_price: number | null };
type Sale = { product_id: string | null; quantity: number; total: number; sold_at: string };

async function load() {
  const [{ data: products }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, sku, name, category, cost_price, sell_price"),
    supabase.from("sales").select("product_id, quantity, total, sold_at"),
  ]);
  return { products: (products ?? []) as Product[], sales: (sales ?? []) as Sale[] };
}

function ProductScore() {
  const { data, isLoading } = useQuery({ queryKey: ["product-score"], queryFn: load });
  const products = data?.products ?? [];
  const sales = data?.sales ?? [];

  const rows = useMemo(() => {
    const maxUnits = Math.max(1, ...products.map((p) => sales.filter((s) => s.product_id === p.id).reduce((a, b) => a + b.quantity, 0)));
    return products.map((p) => {
      const ps = sales.filter((s) => s.product_id === p.id);
      const units = ps.reduce((s, x) => s + x.quantity, 0);
      const revenue = ps.reduce((s, x) => s + Number(x.total), 0);
      const cost = Number(p.cost_price ?? 0);
      const sell = Number(p.sell_price ?? 0);
      const profit = (sell - cost) * units;
      const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
      const roi = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
      // Composite: vendas 40, margem 25, ROI 20, giro 15
      const vendasN = (units / maxUnits) * 100;
      const score = Math.round(vendasN * 0.4 + Math.min(100, margin * 1.5) * 0.25 + Math.min(100, roi) * 0.2 + Math.min(100, units * 2) * 0.15);
      return { ...p, units, revenue, profit, margin, roi, score };
    }).sort((a, b) => b.score - a.score);
  }, [products, sales]);

  const summary = useMemo(() => ({
    avg: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0,
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    profit: rows.reduce((s, r) => s + r.profit, 0),
  }), [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Product Score</h1>
        <p className="text-sm text-muted-foreground">Pontuação 0–100 ponderando vendas, margem, ROI e giro.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="Score médio" value={summary.avg} icon={<Star className="size-4" />} tone="primary" />
        <KPI label="Receita total" value={`R$ ${summary.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<DollarSign className="size-4" />} tone="success" />
        <KPI label="Lucro estimado" value={`R$ ${summary.profit.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<Repeat className="size-4" />} tone="success" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Score</th>
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-right px-3 py-2">Unidades</th>
              <th className="text-right px-3 py-2">Receita</th>
              <th className="text-right px-3 py-2">Lucro</th>
              <th className="text-right px-3 py-2">Margem</th>
              <th className="text-right px-3 py-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando…</td></tr> :
              rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem produtos.</td></tr> :
              rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2"><span className={`inline-block min-w-[3rem] text-center text-xs font-semibold px-2 py-1 rounded ${r.score >= 70 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : r.score >= 40 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>{r.score}</span></td>
                  <td className="px-3 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.sku}</div></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.units}</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {r.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>R$ {r.profit.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.margin.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.roi.toFixed(0)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" | "success" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
