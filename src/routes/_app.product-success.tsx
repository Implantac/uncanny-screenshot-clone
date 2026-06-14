import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/product-success")({ component: ProductSuccess });

type Product = { id: string; sku: string; name: string; category: string | null; cost_price: number | null; sell_price: number | null; image_url: string | null; created_at: string };
type Sale = { product_id: string | null; quantity: number; total: number; sold_at: string };

async function load() {
  const [{ data: products }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, sku, name, category, cost_price, sell_price, image_url, created_at"),
    supabase.from("sales").select("product_id, quantity, total, sold_at"),
  ]);
  return { products: (products ?? []) as Product[], sales: (sales ?? []) as Sale[] };
}

function ProductSuccess() {
  const { data, isLoading } = useQuery({ queryKey: ["product-success"], queryFn: load });
  const products = data?.products ?? [];
  const sales = data?.sales ?? [];

  const scored = useMemo(() => {
    const now = Date.now();
    return products.map((p) => {
      const ps = sales.filter((s) => s.product_id === p.id);
      const units = ps.reduce((s, x) => s + x.quantity, 0);
      const revenue = ps.reduce((s, x) => s + Number(x.total), 0);
      const cost = Number(p.cost_price ?? 0);
      const sell = Number(p.sell_price ?? 0);
      const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
      const ageDays = Math.max(1, (now - new Date(p.created_at).getTime()) / 86400000);
      const velocity = units / ageDays; // units per day
      // Score: velocity 50%, margin 30%, recency boost 20%
      const velScore = Math.min(100, velocity * 30);
      const marScore = Math.max(0, Math.min(100, margin * 1.5));
      const recency = ageDays < 90 ? 100 : ageDays < 180 ? 60 : 30;
      const score = Math.round(velScore * 0.5 + marScore * 0.3 + recency * 0.2);
      return { ...p, units, revenue, margin, velocity, score };
    }).sort((a, b) => b.score - a.score);
  }, [products, sales]);

  const stars = scored.filter((p) => p.score >= 70);
  const risk = scored.filter((p) => p.score < 30);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Product Success Engine</h1>
        <p className="text-sm text-muted-foreground">Score preditivo 0–100 baseado em velocidade, margem e recência.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="Produtos" value={scored.length} icon={<Sparkles className="size-4" />} />
        <KPI label="Estrelas (≥70)" value={stars.length} icon={<TrendingUp className="size-4" />} tone="success" />
        <KPI label="Em risco (<30)" value={risk.length} icon={<AlertTriangle className="size-4" />} tone="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium">Ranking de sucesso</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Score</th>
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-left px-3 py-2">Categoria</th>
              <th className="text-right px-3 py-2">Unidades</th>
              <th className="text-right px-3 py-2">Receita</th>
              <th className="text-right px-3 py-2">Margem</th>
              <th className="text-right px-3 py-2">Velocidade</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando…</td></tr> :
              scored.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem produtos.</td></tr> :
              scored.slice(0, 50).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className={`inline-block min-w-[3rem] text-center text-xs font-semibold px-2 py-1 rounded ${p.score >= 70 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : p.score >= 40 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-destructive/15 text-destructive"}`}>{p.score}</span>
                  </td>
                  <td className="px-3 py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground font-mono">{p.sku}</div></td>
                  <td className="px-3 py-2 text-muted-foreground">{p.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.units}</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {p.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.margin.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.velocity.toFixed(2)}/dia</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "success" | "destructive" }) {
  const toneCls = tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
