import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/_app/replenishment")({
  component: Replenishment,
});

type Item = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  sold30: number;
  sold7: number;
  daysToRupture: number;
  excess: number;
  trend: number;
  suggestion: number;
  reason: string;
};

async function loadReplenishment(): Promise<Item[]> {
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: products }, { data: s30 }, { data: s7 }, { data: inv }] = await Promise.all([
    supabase.from("products").select("id, sku, name").limit(500),
    supabase.from("sales").select("product_id, quantity, sold_at").gte("sold_at", since30),
    supabase.from("sales").select("product_id, quantity").gte("sold_at", since7),
    supabase.from("inventory_items").select("sku, balance"),
  ]);

  const invBySku = new Map((inv ?? []).map((i) => [i.sku, Number(i.balance)]));
  const sum = (rows: { product_id: string | null; quantity: number }[]) => {
    const m = new Map<string, number>();
    rows.forEach((r) => { if (r.product_id) m.set(r.product_id, (m.get(r.product_id) ?? 0) + r.quantity); });
    return m;
  };
  const m30 = sum((s30 ?? []) as { product_id: string | null; quantity: number }[]);
  const m7 = sum((s7 ?? []) as { product_id: string | null; quantity: number }[]);

  return (products ?? []).map((p) => {
    const stock = invBySku.get(p.sku) ?? 0;
    const sold30 = m30.get(p.id) ?? 0;
    const sold7 = m7.get(p.id) ?? 0;
    const daily = sold30 / 30;
    const dailyRecent = sold7 / 7;
    const trend = daily > 0 ? ((dailyRecent - daily) / daily) * 100 : 0;
    const daysToRupture = daily > 0 ? Math.floor(stock / daily) : 999;
    const target45 = Math.ceil(daily * 45);
    const suggestion = Math.max(0, target45 - stock);
    const excess = Math.max(0, stock - target45 * 2);
    const reason = trend > 20 ? `Vendas subindo +${Math.round(trend)}% — antecipar reposição` :
                   daysToRupture < 7 ? `Ruptura em ${daysToRupture} dias` :
                   excess > 0 ? `${excess} un acima do necessário — sugerir liquidação` :
                   "Estoque alinhado à demanda";
    return { id: p.id, sku: p.sku, name: p.name, stock, sold30, sold7, daysToRupture, excess, trend, suggestion, reason };
  });
}

function Replenishment() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ["replenishment"], queryFn: loadReplenishment });

  const rupture = useMemo(() => items.filter((i) => i.daysToRupture < 14 && i.sold30 > 0).sort((a, b) => a.daysToRupture - b.daysToRupture), [items]);
  const suggestions = useMemo(() => items.filter((i) => i.suggestion > 0).sort((a, b) => b.suggestion - a.suggestion).slice(0, 30), [items]);
  const excess = useMemo(() => items.filter((i) => i.excess > 0).sort((a, b) => b.excess - a.excess).slice(0, 30), [items]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Replenishment AI</h1>
        <p className="text-sm text-muted-foreground">Reposição inteligente, previsão de ruptura e excesso de estoque.</p>
      </header>

      {isLoading && <div className="text-muted-foreground">Calculando…</div>}

      <Section title="Previsão de ruptura" icon={<TrendingDown className="size-4 text-destructive" />} desc="Produtos que vão acabar em breve">
        <Table items={rupture} columns={["Cobertura", "Vendido 30d", "Estoque", "Sugestão"]} render={(i) => [
          <span className="text-destructive font-semibold">{i.daysToRupture}d</span>, i.sold30, i.stock, i.suggestion,
        ]} />
      </Section>

      <Section title="Sugestões de reposição" icon={<Sparkles className="size-4 text-primary" />} desc="Quantidade sugerida para cobertura de 45 dias">
        <Table items={suggestions} columns={["Sugestão", "Tendência", "Vendido 30d", "Estoque"]} render={(i) => [
          <span className="text-primary font-semibold">{i.suggestion}</span>,
          <span className={i.trend > 0 ? "text-success" : "text-muted-foreground"}>{i.trend > 0 ? "+" : ""}{Math.round(i.trend)}%</span>,
          i.sold30, i.stock,
        ]} />
      </Section>

      <Section title="Excesso de estoque" icon={<TrendingUp className="size-4 text-warning" />} desc="Risco de encalhe — considerar liquidação">
        <Table items={excess} columns={["Excesso", "Estoque", "Vendido 30d", "Sugestão"]} render={(i) => [
          <span className="text-warning font-semibold">+{i.excess}</span>, i.stock, i.sold30, "Liquidar",
        ]} />
      </Section>
    </div>
  );
}

function Section({ title, icon, desc, children }: { title: string; icon: React.ReactNode; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 font-medium">{icon}{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function Table({ items, columns, render }: { items: Item[]; columns: string[]; render: (i: Item) => React.ReactNode[] }) {
  if (items.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">Nada por aqui.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">SKU</th>
            <th className="text-left px-3 py-2">Produto</th>
            {columns.map((c) => <th key={c} className="text-right px-3 py-2">{c}</th>)}
            <th className="text-left px-3 py-2">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
              <td className="px-3 py-2 truncate max-w-[180px]">{i.name}</td>
              {render(i).map((cell, idx) => <td key={idx} className="px-3 py-2 text-right">{cell}</td>)}
              <td className="px-3 py-2 text-xs text-muted-foreground">{i.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
