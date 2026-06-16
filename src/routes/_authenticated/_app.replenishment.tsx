import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, TrendingUp, Sparkles, Flame, Brain } from "lucide-react";
import { useMemo } from "react";
import { computePriority, classifyABC, type PriorityResult } from "@/lib/priority-score";

export const Route = createFileRoute("/_authenticated/_app/replenishment")({
  head: () => ({ meta: [{ title: "Necessidade de Produção · USE MODA PLM" }] }),
  component: Replenishment,
});

type Row = PriorityResult & {
  id: string;
  name: string;
  stock: number;
  wip: number;
  revenue30: number;
};

async function loadReplenishment(): Promise<Row[]> {
  const now = Date.now();
  const since90 = new Date(now - 90 * 86400000).toISOString();
  const since30 = new Date(now - 30 * 86400000).toISOString();
  const since7 = new Date(now - 7 * 86400000).toISOString();

  const [{ data: products }, { data: erpInv }, { data: invItems }, { data: s90 }, { data: ops }] = await Promise.all([
    supabase.from("products").select("id, sku, name, cost_price, sell_price, status").eq("status", "aprovado").limit(800),
    supabase.from("erp_inventory_mirror").select("sku, balance").limit(2000),
    supabase.from("inventory_items").select("sku, balance").limit(2000),
    supabase.from("erp_sales_mirror").select("sku, quantity, total_value, sold_at").gte("sold_at", since90).limit(20000),
    supabase.from("production_orders").select("products(sku), quantity, stage").neq("status", "cancelada").limit(2000),
  ]);

  // estoque = ERP mirror se houver, senão almoxarifado PLM
  const stockBySku = new Map<string, number>();
  (erpInv ?? []).forEach((r) => {
    const k = r.sku ?? "";
    stockBySku.set(k, (stockBySku.get(k) ?? 0) + Number(r.balance ?? 0));
  });
  (invItems ?? []).forEach((r) => {
    if (!stockBySku.has(r.sku)) stockBySku.set(r.sku, Number(r.balance ?? 0));
  });

  // WIP por SKU (OPs ativas)
  const wipBySku = new Map<string, number>();
  (ops ?? []).forEach((o: any) => {
    if (o.stage === "entregue") return;
    const sku = o.products?.sku;
    if (!sku) return;
    wipBySku.set(sku, (wipBySku.get(sku) ?? 0) + Number(o.quantity ?? 0));
  });

  // vendas por janela
  const sumWin = (rows: any[], cutoff: string, key: "quantity" | "total_value") => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      if (!r.sku || !r.sold_at || r.sold_at < cutoff) return;
      m.set(r.sku, (m.get(r.sku) ?? 0) + Number(r[key] ?? 0));
    });
    return m;
  };
  const sold90 = sumWin((s90 ?? []) as any[], since90, "quantity");
  const sold30 = sumWin((s90 ?? []) as any[], since30, "quantity");
  const sold7 = sumWin((s90 ?? []) as any[], since7, "quantity");
  const rev30 = sumWin((s90 ?? []) as any[], since30, "total_value");

  // ABC pela receita 30d
  const abc = classifyABC([...rev30.entries()].map(([sku, revenue]) => ({ sku, revenue })));

  return (products ?? []).map((p) => {
    const r = computePriority({
      sku: p.sku,
      sold7: sold7.get(p.sku) ?? 0,
      sold30: sold30.get(p.sku) ?? 0,
      sold90: sold90.get(p.sku) ?? 0,
      stock: stockBySku.get(p.sku) ?? 0,
      wip: wipBySku.get(p.sku) ?? 0,
      cost: p.cost_price ? Number(p.cost_price) : null,
      price: p.sell_price ? Number(p.sell_price) : null,
      abc: abc.get(p.sku) ?? 3,
    });
    return {
      ...r,
      id: p.id,
      name: p.name,
      stock: stockBySku.get(p.sku) ?? 0,
      wip: wipBySku.get(p.sku) ?? 0,
      revenue30: rev30.get(p.sku) ?? 0,
    };
  });
}

function Replenishment() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ["replenishment-v2"], queryFn: loadReplenishment });

  const priority = useMemo(
    () => items.filter((i) => i.suggestion > 0).sort((a, b) => b.score - a.score).slice(0, 40),
    [items],
  );
  const rupture = useMemo(
    () => items.filter((i) => i.daysCover < 14 && i.velocity > 0).sort((a, b) => a.daysCover - b.daysCover).slice(0, 30),
    [items],
  );
  const excess = useMemo(
    () => items.filter((i) => i.daysCover > 120 && i.stock > 0).sort((a, b) => b.stock - a.stock).slice(0, 30),
    [items],
  );

  const summary = useMemo(() => ({
    total: items.length,
    actionable: priority.length,
    rupture: rupture.length,
    excess: excess.length,
  }), [items, priority, rupture, excess]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Brain className="size-6 text-primary" />Necessidade de Produção
          </h1>
          <p className="text-sm text-muted-foreground">
            Motor inteligente — combina estoque, WIP, vendas 7/30/90d, margem, ABC e sazonalidade. Score 0–100 por SKU.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <Mini label="SKUs analisados" v={summary.total} />
          <Mini label="A produzir" v={summary.actionable} tone="primary" />
          <Mini label="Em ruptura" v={summary.rupture} tone="red" />
          <Mini label="Excesso" v={summary.excess} tone="yellow" />
        </div>
      </header>

      {isLoading && <div className="text-muted-foreground">Calculando prioridades…</div>}

      <Section title="Prioridade de produção" icon={<Flame className="size-4 text-primary" />} desc="Ordenado por score — combina giro, margem, ruptura, ABC e tendência">
        <PriorityTable items={priority} />
      </Section>

      <Section title="Risco de ruptura" icon={<TrendingDown className="size-4 text-destructive" />} desc="Cobertura inferior a 14 dias">
        <PriorityTable items={rupture} />
      </Section>

      <Section title="Excesso de estoque" icon={<TrendingUp className="size-4 text-warning" />} desc="Cobertura acima de 120 dias — considerar liquidar">
        <PriorityTable items={excess} hideSuggestion />
      </Section>
    </div>
  );
}

function Mini({ label, v, tone }: { label: string; v: number; tone?: "primary" | "red" | "yellow" }) {
  const c = tone === "red" ? "text-destructive" : tone === "yellow" ? "text-warning" : tone === "primary" ? "text-primary" : "";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${c}`}>{v}</div>
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

function PriorityTable({ items, hideSuggestion }: { items: Row[]; hideSuggestion?: boolean }) {
  if (items.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">Nada por aqui. ✅</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 w-16">Score</th>
            <th className="text-left px-3 py-2">SKU · Produto</th>
            <th className="text-left px-3 py-2">Veredito</th>
            <th className="text-right px-3 py-2">Estoque</th>
            <th className="text-right px-3 py-2">WIP</th>
            <th className="text-right px-3 py-2">Stockout</th>
            <th className="text-right px-3 py-2">Velocidade</th>
            {!hideSuggestion && <th className="text-right px-3 py-2">Sugestão</th>}
            <th className="text-left px-3 py-2">Motivos</th>
            {!hideSuggestion && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-border hover:bg-muted/20 align-top">
              <td className="px-3 py-2">
                <ScoreBadge score={i.score} />
              </td>
              <td className="px-3 py-2">
                <div className="font-mono text-xs text-muted-foreground">{i.sku}</div>
                <div className="truncate max-w-[220px]">{i.name}</div>
              </td>
              <td className="px-3 py-2 max-w-[220px]">
                <VerdictBadge verdict={i.verdict} label={i.verdictLabel} />
                <div className="text-[10px] text-muted-foreground mt-1 leading-snug">{i.verdictReason}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{i.stock}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.wip || "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={i.daysToStockout < 14 ? "text-destructive" : i.daysToStockout > 120 ? "text-warning" : ""}>
                  {i.daysToStockout >= 999 ? "—" : `${Math.round(i.daysToStockout)}d`}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{i.velocity.toFixed(1)}/d</td>
              {!hideSuggestion && (
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{i.suggestion || "—"}</td>
              )}
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {i.reasons.join(" · ")}
              </td>
              {!hideSuggestion && (
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/pcp-kanban"
                    className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1"
                  >
                    <Sparkles className="size-3" /> Gerar OP
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerdictBadge({ verdict, label }: { verdict: PriorityResult["verdict"]; label: string }) {
  const tone =
    verdict === "produzir-ja" ? "bg-destructive/15 text-destructive border-destructive/30"
    : verdict === "programar" ? "bg-primary/10 text-primary border-primary/30"
    : verdict === "monitorar" ? "bg-warning/15 text-warning border-warning/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}


function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75 ? "bg-destructive/15 text-destructive border-destructive/30"
    : score >= 50 ? "bg-warning/15 text-warning border-warning/30"
    : score >= 25 ? "bg-primary/10 text-primary border-primary/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-7 rounded border font-semibold text-sm tabular-nums ${tone}`}>
      {score}
    </span>
  );
}
