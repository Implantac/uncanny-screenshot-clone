import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Truck, Users, Calendar, Sparkles, AlertTriangle, ArrowRight, Trophy } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/cadeia-360")({
  head: () => ({
    meta: [
      { title: "Cadeia 360º · USE MODA PLM" },
      { name: "description", content: "Portal do fornecedor, sourcing inteligente e calendário de capacidade." },
    ],
  }),
  component: Cadeia360,
});

type Supplier = { id: string; name: string; category: string | null; rating: number | null; active: boolean };
type Order = {
  id: string; code: string; quantity: number; stage: string; status: string;
  due_date: string | null; supplier_id: string | null; product_id: string | null;
  stage_updated_at: string;
  products: { name: string; sku: string; category: string | null } | null;
};
type Product = { id: string; name: string; sku: string; category: string | null; status: string };

async function loadAll() {
  const [suppliers, orders, products] = await Promise.all([
    supabase.from("suppliers").select("id, name, category, rating, active").eq("active", true).limit(200),
    supabase.from("production_orders")
      .select("id, code, quantity, stage, status, due_date, supplier_id, product_id, stage_updated_at, products(name, sku, category)")
      .neq("status", "cancelada").limit(1000),
    supabase.from("products").select("id, name, sku, category, status").eq("status", "aprovado").limit(500),
  ]);
  return {
    suppliers: (suppliers.data ?? []) as Supplier[],
    orders: (orders.data ?? []) as unknown as Order[],
    products: (products.data ?? []) as Product[],
  };
}

function Cadeia360() {
  useRealtime("production_orders", ["cadeia-360"]);
  const { data, isLoading } = useQuery({ queryKey: ["cadeia-360"], queryFn: loadAll });
  const suppliers = data?.suppliers ?? [];
  const orders = data?.orders ?? [];
  const products = data?.products ?? [];
  const now = Date.now();

  // Score do fornecedor: rating + OTD calculado das OPs entregues
  const scored = useMemo(() => {
    return suppliers.map((s) => {
      const sOrders = orders.filter((o) => o.supplier_id === s.id);
      const delivered = sOrders.filter((o) => o.stage === "entregue" && o.due_date);
      const onTime = delivered.filter((o) => new Date(o.stage_updated_at).getTime() <= new Date(o.due_date!).getTime() + 86400000).length;
      const otd = delivered.length > 0 ? onTime / delivered.length : 0;
      const active = sOrders.filter((o) => o.stage !== "entregue");
      const load = active.reduce((a, o) => a + o.quantity, 0);
      const overdue = active.filter((o) => o.due_date && new Date(o.due_date).getTime() < now).length;
      const score = Math.round(((s.rating ?? 0) / 5) * 50 + otd * 50);
      return { supplier: s, otd, load, overdue, activeCount: active.length, score, categories: new Set(sOrders.map((o) => o.products?.category).filter(Boolean) as string[]) };
    }).sort((a, b) => b.score - a.score);
  }, [suppliers, orders, now]);

  // Sourcing: produtos aprovados sem OP, sugere fornecedor pela categoria + score
  const sourcing = useMemo(() => {
    const productsWithOP = new Set(orders.filter((o) => o.stage !== "entregue").map((o) => o.product_id).filter(Boolean));
    return products
      .filter((p) => !productsWithOP.has(p.id))
      .slice(0, 10)
      .map((p) => {
        const candidates = scored
          .filter((s) => !p.category || s.categories.has(p.category) || s.supplier.category === p.category)
          .slice(0, 3);
        const best = candidates[0] ?? scored[0];
        return { product: p, suggestion: best };
      });
  }, [products, orders, scored]);

  // Capacidade — próximas 8 semanas, qty agrupada por fornecedor/semana
  const heatmap = useMemo(() => {
    const weeks: { label: string; start: number; end: number }[] = [];
    const monday = new Date(); monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 0; i < 8; i++) {
      const start = new Date(monday); start.setDate(start.getDate() + i * 7);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      weeks.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, start: start.getTime(), end: end.getTime() });
    }
    const rows = scored.slice(0, 8).map((s) => {
      const cells = weeks.map((w) => {
        const qty = orders
          .filter((o) => o.supplier_id === s.supplier.id && o.stage !== "entregue" && o.due_date)
          .filter((o) => { const t = new Date(o.due_date!).getTime(); return t >= w.start && t < w.end; })
          .reduce((a, o) => a + o.quantity, 0);
        return qty;
      });
      const max = Math.max(...cells, 1);
      return { name: s.supplier.name, cells, max };
    });
    return { weeks, rows };
  }, [scored, orders]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Truck className="size-6 text-primary" />Cadeia 360º
        </h1>
        <p className="text-sm text-muted-foreground">Portal de fornecedores, sourcing inteligente e calendário de capacidade — em uma tela.</p>
      </header>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      {/* Sourcing */}
      <section className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-primary" />Sourcing inteligente</div>
          <span className="text-xs text-muted-foreground">Match por categoria + score</span>
        </div>
        {sourcing.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Todos os produtos aprovados estão em produção. ✅</div>
        ) : (
          <ul className="divide-y divide-border">
            {sourcing.map(({ product, suggestion }) => (
              <li key={product.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{product.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{product.sku} · {product.category ?? "sem categoria"}</div>
                </div>
                <div className="flex items-center gap-3">
                  {suggestion ? (
                    <div className="text-right">
                      <div className="text-xs">{suggestion.supplier.name}</div>
                      <div className="text-[10px] text-muted-foreground">score {suggestion.score} · OTD {Math.round(suggestion.otd * 100)}%</div>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">sem fornecedor</span>}
                  <Link to="/pcp" className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90">Criar OP</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Calendário de capacidade */}
      <section className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><Calendar className="size-4 text-primary" />Calendário de capacidade (8 semanas)</div>
          <Link to="/capacity" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Detalhes <ArrowRight className="size-3" /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                {heatmap.weeks.map((w) => <th key={w.label} className="text-center px-2 py-2 font-medium tabular-nums">{w.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="px-3 py-2 truncate max-w-[160px]">{r.name}</td>
                  {r.cells.map((qty, i) => {
                    const intensity = qty === 0 ? 0 : Math.min(1, qty / r.max);
                    const bg = qty === 0 ? "transparent" : `color-mix(in oklab, hsl(var(--primary)) ${Math.round(intensity * 70)}%, transparent)`;
                    return (
                      <td key={i} className="px-2 py-2 text-center tabular-nums" style={{ background: bg }}>
                        {qty > 0 ? qty : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {heatmap.rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Portal-like: ranking + OPs por fornecedor */}
      <section className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><Users className="size-4 text-primary" />Portal de fornecedores</div>
          <Link to="/fornecedores" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Cadastro <ArrowRight className="size-3" /></Link>
        </div>
        <ul className="divide-y divide-border">
          {scored.slice(0, 10).map((s) => (
            <li key={s.supplier.id} className="px-4 py-3 grid grid-cols-12 items-center gap-2 text-sm">
              <div className="col-span-4 min-w-0">
                <div className="truncate flex items-center gap-1.5">
                  {s.score >= 70 && <Trophy className="size-3 text-warning" />}
                  {s.supplier.name}
                </div>
                <div className="text-[10px] text-muted-foreground">{s.supplier.category ?? "—"}</div>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground tabular-nums">{s.activeCount} OPs</div>
              <div className="col-span-2 text-xs text-muted-foreground tabular-nums">{s.load} un</div>
              <div className="col-span-2 text-xs tabular-nums">
                {s.overdue > 0 ? (
                  <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="size-3" />{s.overdue} atrasadas</span>
                ) : <span className="text-success">no prazo</span>}
              </div>
              <div className="col-span-2 text-right">
                <span className={`text-sm font-semibold tabular-nums ${s.score >= 70 ? "text-success" : s.score >= 40 ? "text-warning" : "text-destructive"}`}>{s.score}</span>
                <div className="text-[10px] text-muted-foreground">OTD {Math.round(s.otd * 100)}%</div>
              </div>
            </li>
          ))}
          {scored.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum fornecedor ativo.</li>}
        </ul>
      </section>
    </div>
  );
}
