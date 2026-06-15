import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  Brain, AlertTriangle, Clock, Factory, Zap, Trophy, Star, Boxes,
  ArrowRight, TrendingUp, PackageSearch,
} from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/intel-hub")({
  head: () => ({
    meta: [
      { title: "Inteligência Operacional · USE MODA PLM" },
      { name: "description", content: "Hub unificado de alertas, reposição técnica e scores do PLM." },
    ],
  }),
  component: IntelHub,
});

type Order = {
  id: string; code: string; stage: string; status: string;
  quantity: number; due_date: string | null; priority: number;
  stage_updated_at: string; batch_code: string | null;
  products: { name: string; sku: string } | null;
  suppliers: { name: string } | null;
};
type Batch = { id: string; code: string; name: string | null; status: string; planned_quantity: number | null; produced_quantity: number | null; updated_at: string };
type Product = { id: string; name: string; sku: string; cost_price: number | null; sale_price: number | null; status: string };
type Supplier = { id: string; name: string; rating: number | null; on_time_delivery_rate: number | null };

async function loadAll() {
  const today = new Date().toISOString().slice(0, 10);
  const [orders, batches, products, suppliers] = await Promise.all([
    supabase.from("production_orders")
      .select("id, code, stage, status, quantity, due_date, priority, stage_updated_at, batch_code, products(name, sku), suppliers(name)")
      .neq("status", "cancelada").limit(500),
    supabase.from("production_batches")
      .select("id, code, name, status, planned_quantity, produced_quantity, updated_at")
      .in("status", ["planejado", "em_producao"]).limit(50),
    supabase.from("products")
      .select("id, name, sku, cost_price, sale_price, status").eq("status", "aprovado").limit(200),
    supabase.from("suppliers")
      .select("id, name, rating, on_time_delivery_rate").limit(100),
  ]);
  return {
    orders: (orders.data ?? []) as unknown as Order[],
    batches: (batches.data ?? []) as unknown as Batch[],
    products: (products.data ?? []) as unknown as Product[],
    suppliers: (suppliers.data ?? []) as unknown as Supplier[],
    today,
  };
}

function IntelHub() {
  useRealtime("production_orders", ["intel-hub"]);
  useRealtime("production_batches", ["intel-hub"]);
  const { data, isLoading } = useQuery({ queryKey: ["intel-hub"], queryFn: loadAll });
  const orders = data?.orders ?? [];
  const batches = data?.batches ?? [];
  const products = data?.products ?? [];
  const suppliers = data?.suppliers ?? [];

  const now = Date.now();
  const alerts = useMemo(() => {
    const overdue = orders.filter((o) => o.stage !== "entregue" && o.due_date && new Date(o.due_date).getTime() < now);
    const dueSoon = orders.filter((o) => o.stage !== "entregue" && o.due_date && new Date(o.due_date).getTime() >= now && (new Date(o.due_date).getTime() - now) < 7 * 86400000);
    const stuckOrders = orders.filter((o) => o.stage !== "entregue" && (now - new Date(o.stage_updated_at).getTime()) > 5 * 86400000);
    const stuckBatches = batches.filter((b) => (now - new Date(b.updated_at).getTime()) > 7 * 86400000);
    const stageCounts = new Map<string, number>();
    orders.filter((o) => o.stage !== "entregue").forEach((o) => stageCounts.set(o.stage, (stageCounts.get(o.stage) ?? 0) + o.quantity));
    const bottleneck = [...stageCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { overdue, dueSoon, stuckOrders, stuckBatches, bottleneck };
  }, [orders, batches, now]);

  // Reposição técnica: produtos sem OP ativa
  const replenishment = useMemo(() => {
    const productsWithActiveOP = new Set(
      orders.filter((o) => o.stage !== "entregue").map((o) => o.products?.sku).filter(Boolean),
    );
    return products
      .filter((p) => !productsWithActiveOP.has(p.sku))
      .slice(0, 8)
      .map((p) => ({
        ...p,
        margin: p.sale_price && p.cost_price ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : null,
      }));
  }, [products, orders]);

  // Supplier score
  const supplierScore = useMemo(() => {
    return suppliers
      .map((s) => ({
        ...s,
        score: Math.round(((s.rating ?? 0) / 5) * 50 + (s.on_time_delivery_rate ?? 0) * 50),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [suppliers]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Brain className="size-6 text-primary" />Inteligência Operacional
          </h1>
          <p className="text-sm text-muted-foreground">Hub unificado: alertas, reposição técnica e scores — sinais que o PCP precisa agir.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/intelligence" className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted">Intelligence Engine</Link>
          <Link to="/control-tower" className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted">Control Tower</Link>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="OPs atrasadas" value={alerts.overdue.length} icon={<AlertTriangle className="size-4" />} tone="red" to="/twin-factory" />
        <KPI label="Vencem em 7d" value={alerts.dueSoon.length} icon={<Clock className="size-4" />} tone="yellow" to="/pcp-kanban" />
        <KPI label="OPs paradas >5d" value={alerts.stuckOrders.length} icon={<Factory className="size-4" />} tone="primary" to="/pcp-kanban" />
        <KPI label="Lotes inertes" value={alerts.stuckBatches.length} icon={<Boxes className="size-4" />} tone="primary" to="/lotes" />
        <KPI label="Gargalo" value={alerts.bottleneck?.[0] ?? "—"} icon={<TrendingUp className="size-4" />} tone="primary" to="/twin-factory" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4 text-destructive" />Alertas operacionais</div>
            <Link to="/twin-factory" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Torre <ArrowRight className="size-3" /></Link>
          </div>
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : alerts.overdue.length === 0 && alerts.stuckOrders.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sem alertas críticos. ✅</div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.overdue.slice(0, 5).map((o) => (
                <li key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-destructive">{o.code} · atrasada</div>
                    <div className="truncate text-muted-foreground">{o.products?.name ?? "—"} · {o.suppliers?.name ?? "sem fornecedor"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {Math.ceil((now - new Date(o.due_date!).getTime()) / 86400000)}d
                  </div>
                </li>
              ))}
              {alerts.stuckOrders.slice(0, 3).map((o) => (
                <li key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-orange-500">{o.code} · parada em {o.stage}</div>
                    <div className="truncate text-muted-foreground">{o.products?.name ?? "—"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {Math.floor((now - new Date(o.stage_updated_at).getTime()) / 86400000)}d
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reposição técnica */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium"><Zap className="size-4 text-primary" />Reposição técnica sugerida</div>
            <Link to="/replenishment" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Ver tudo <ArrowRight className="size-3" /></Link>
          </div>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border bg-muted/20">
            Produtos ativos sem OP em andamento — candidatos a nova ordem de produção.
          </div>
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : replenishment.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todos os produtos ativos têm OP em andamento. ✅</div>
          ) : (
            <ul className="divide-y divide-border">
              {replenishment.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.margin !== null && (
                      <span className={`text-xs tabular-nums ${p.margin >= 40 ? "text-success" : p.margin >= 20 ? "text-warning" : "text-destructive"}`}>
                        {Math.round(p.margin)}% mg
                      </span>
                    )}
                    <Link to="/pcp" className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90">Criar OP</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Supplier score */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium"><Trophy className="size-4 text-warning" />Top fornecedores</div>
            <Link to="/supplier-score" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Scorecard <ArrowRight className="size-3" /></Link>
          </div>
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div> : supplierScore.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sem dados de fornecedores.</div>
          ) : (
            <ul className="divide-y divide-border">
              {supplierScore.map((s) => (
                <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 truncate">{s.name}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">OTD {Math.round((s.on_time_delivery_rate ?? 0) * 100)}%</span>
                    <span className={`text-sm font-semibold tabular-nums ${s.score >= 70 ? "text-success" : s.score >= 40 ? "text-warning" : "text-destructive"}`}>{s.score}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Atalhos de inteligência */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 font-medium">
            <Star className="size-4 text-primary" />Inteligência cruzada
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            <ShortcutLink to="/product-score" icon={<Star className="size-4" />} title="Product Score" hint="Pontuação 0–100" />
            <ShortcutLink to="/product-success" icon={<TrendingUp className="size-4" />} title="Product Success" hint="Probabilidade" />
            <ShortcutLink to="/grade-needs" icon={<PackageSearch className="size-4" />} title="Necessidade por grade" hint="PP/P/M/G/GG" />
            <ShortcutLink to="/control-tower" icon={<Factory className="size-4" />} title="Control Tower" hint="Demand & supply" />
          </div>
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone, to }: { label: string; value: number | string; icon: React.ReactNode; tone: "red" | "yellow" | "green" | "primary"; to: string }) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <Link to={to} className={`rounded-xl border p-4 bg-card hover:bg-muted/30 transition-colors ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Link>
  );
}

function ShortcutLink({ to, icon, title, hint }: { to: string; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-muted/20 p-3 hover:border-primary transition-colors">
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </Link>
  );
}
