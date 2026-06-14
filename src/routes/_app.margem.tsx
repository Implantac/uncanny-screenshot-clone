import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { TrendingUp, DollarSign, Percent, Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/margem")({
  component: MargemPage,
});

type Row = {
  id: string;
  sku: string;
  name: string;
  collection: string | null;
  cost: number;
  price: number;
  qty: number;
  revenue: number;
  cmv: number;
  margin: number;
  marginPct: number;
  markup: number;
  abc: "A" | "B" | "C";
};

async function load(): Promise<Row[]> {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [{ data: products }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, sku, name, cost_price, sell_price, collections(name)").limit(1000),
    supabase.from("sales").select("product_id, quantity, total, unit_price").gte("sold_at", since),
  ]);

  const agg = new Map<string, { qty: number; revenue: number }>();
  (sales ?? []).forEach((s) => {
    if (!s.product_id) return;
    const cur = agg.get(s.product_id) ?? { qty: 0, revenue: 0 };
    cur.qty += s.quantity;
    cur.revenue += Number(s.total);
    agg.set(s.product_id, cur);
  });

  const rows: Row[] = (products ?? []).map((p) => {
    const a = agg.get(p.id) ?? { qty: 0, revenue: 0 };
    const cost = Number(p.cost_price ?? 0);
    const price = Number(p.sell_price ?? 0);
    const cmv = cost * a.qty;
    const margin = a.revenue - cmv;
    const marginPct = a.revenue > 0 ? (margin / a.revenue) * 100 : 0;
    const markup = cost > 0 ? ((price - cost) / cost) * 100 : 0;
    return {
      id: p.id, sku: p.sku, name: p.name,
      collection: (p.collections as { name?: string } | null)?.name ?? null,
      cost, price, qty: a.qty, revenue: a.revenue, cmv, margin, marginPct, markup,
      abc: "C" as const,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // ABC classification by revenue
  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  let acc = 0;
  rows.forEach((r) => {
    acc += r.revenue;
    const pct = totalRev > 0 ? acc / totalRev : 0;
    r.abc = pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
  });
  return rows;
}

function MargemPage() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["margem"], queryFn: load });
  const [filter, setFilter] = useState<"all" | "A" | "B" | "C">("all");

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.abc === filter), [rows, filter]);

  const totals = useMemo(() => {
    const sold = rows.filter((r) => r.qty > 0);
    const revenue = sold.reduce((s, r) => s + r.revenue, 0);
    const cmv = sold.reduce((s, r) => s + r.cmv, 0);
    const margin = revenue - cmv;
    return {
      revenue, cmv, margin,
      marginPct: revenue > 0 ? (margin / revenue) * 100 : 0,
      avgMarkup: sold.length > 0 ? sold.reduce((s, r) => s + r.markup, 0) / sold.length : 0,
      topSku: sold[0],
    };
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Margem & Rentabilidade</h1>
        <p className="text-sm text-muted-foreground">CMV, margem real, markup e curva ABC dos últimos 90 dias.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Receita 90d" value={fmt(totals.revenue)} icon={<DollarSign className="size-4" />} />
        <KPI label="Margem bruta" value={fmt(totals.margin)} icon={<TrendingUp className="size-4" />} tone="success" />
        <KPI label="Margem %" value={`${totals.marginPct.toFixed(1)}%`} icon={<Percent className="size-4" />} tone="primary" />
        <KPI label="Top SKU" value={totals.topSku?.sku ?? "—"} icon={<Trophy className="size-4" />} tone="warning" />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Curva ABC:</span>
        {(["all", "A", "B", "C"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded-full border text-xs ${filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}>
            {k === "all" ? "Todos" : `Classe ${k}`}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">ABC</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2">Custo</th>
                <th className="text-right px-3 py-2">Preço</th>
                <th className="text-right px-3 py-2">Markup</th>
                <th className="text-right px-3 py-2">Qtd</th>
                <th className="text-right px-3 py-2">Receita</th>
                <th className="text-right px-3 py-2">CMV</th>
                <th className="text-right px-3 py-2">Margem</th>
                <th className="text-right px-3 py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Sem dados.</td></tr>}
              {filtered.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.abc === "A" ? "bg-success/15 text-success" : r.abc === "B" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>{r.abc}</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{r.name}<div className="text-[10px] text-muted-foreground">{r.collection ?? "—"}</div></td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.cost)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.price)}</td>
                  <td className="px-3 py-2 text-right">{r.markup.toFixed(0)}%</td>
                  <td className="px-3 py-2 text-right">{r.qty}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(r.revenue)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.cmv)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.margin >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.margin)}</td>
                  <td className={`px-3 py-2 text-right ${r.marginPct >= 40 ? "text-success" : r.marginPct >= 20 ? "text-warning" : "text-destructive"}`}>{r.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: "default" | "success" | "primary" | "warning" }) {
  const tones = { default: "", success: "text-success", primary: "text-primary", warning: "text-warning" };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
