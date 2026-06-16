import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  Compass, Layers, Scissors, Factory, TrendingUp, Percent, DollarSign,
  Package, ArrowRight, Sparkles, AlertTriangle, FileWarning, Clock, CheckCircle2, Radio, Wallet, Database,
} from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/colecao-360")({
  head: () => ({
    meta: [
      { title: "Coleção 360º · USE MODA PLM" },
      { name: "description", content: "Visão única da coleção: protótipos, produtos, OPs, vendas e margem." },
    ],
  }),
  component: Colecao360,
});

type Collection = { id: string; name: string; season: string | null; year: number | null; status: string };
type Product = { id: string; collection_id: string | null; name: string; sku: string; status: string; cost_price: number | null; sell_price: number | null };
type Prototype = { id: string; product_id: string | null; stage: string };
type Order = { id: string; product_id: string | null; stage: string; status: string; quantity: number };
type Sale = { product_id: string | null; quantity: number; total: number | null };

type Sheet = { product_id: string | null; status: string };

async function loadAll() {
  const [collections, products, prototypes, orders, sales, sheets] = await Promise.all([
    supabase.from("collections").select("id, name, season, year, status").order("year", { ascending: false }).limit(50),
    supabase.from("products").select("id, collection_id, name, sku, status, cost_price, sell_price").limit(1000),
    supabase.from("prototypes").select("id, product_id, stage").limit(1000),
    supabase.from("production_orders").select("id, product_id, stage, status, quantity").neq("status", "cancelada").limit(1000),
    supabase.from("sales").select("product_id, quantity, total").limit(5000),
    supabase.from("tech_sheets").select("product_id, status").limit(2000),
  ]);
  return {
    collections: (collections.data ?? []) as Collection[],
    products: (products.data ?? []) as Product[],
    prototypes: (prototypes.data ?? []) as Prototype[],
    orders: (orders.data ?? []) as Order[],
    sales: (sales.data ?? []) as Sale[],
    sheets: (sheets.data ?? []) as Sheet[],
  };
}

function Colecao360() {
  useRealtime("production_orders", ["colecao-360"]);
  const { data, isLoading } = useQuery({ queryKey: ["colecao-360"], queryFn: loadAll });
  const collections = data?.collections ?? [];
  const products = data?.products ?? [];
  const prototypes = data?.prototypes ?? [];
  const orders = data?.orders ?? [];
  const sales = data?.sales ?? [];
  const sheets = data?.sheets ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentId = selectedId ?? collections[0]?.id ?? null;

  const summary = useMemo(() => {
    return collections.map((c) => {
      const cProducts = products.filter((p) => p.collection_id === c.id);
      const productIds = new Set(cProducts.map((p) => p.id));
      const cProtos = prototypes.filter((p) => p.product_id && productIds.has(p.product_id));
      const cOrders = orders.filter((o) => o.product_id && productIds.has(o.product_id));
      const cSales = sales.filter((s) => s.product_id && productIds.has(s.product_id));

      const revenue = cSales.reduce((a, s) => a + Number(s.total ?? 0), 0);
      const unitsSold = cSales.reduce((a, s) => a + s.quantity, 0);
      const opsActive = cOrders.filter((o) => o.stage !== "entregue").length;
      const opsDone = cOrders.filter((o) => o.stage === "entregue").length;
      const producedQty = cOrders.filter((o) => o.stage === "entregue").reduce((a, o) => a + o.quantity, 0);

      const avgCost = cProducts.length ? cProducts.reduce((a, p) => a + Number(p.cost_price ?? 0), 0) / cProducts.length : 0;
      const avgPrice = cProducts.length ? cProducts.reduce((a, p) => a + Number(p.sell_price ?? 0), 0) / cProducts.length : 0;
      const margin = avgPrice > 0 ? ((avgPrice - avgCost) / avgPrice) * 100 : 0;
      const sellThrough = producedQty > 0 ? (unitsSold / producedQty) * 100 : 0;

      // Investimento × Resultado (espelho ERP)
      const investment = cOrders.reduce((a, o) => {
        const p = cProducts.find((pr) => pr.id === o.product_id);
        return a + Number(p?.cost_price ?? avgCost) * o.quantity;
      }, 0);
      const profit = revenue - investment;
      const roi = investment > 0 ? (profit / investment) * 100 : 0;

      // Sala de Guerra — derivados
      const productsWithApprovedProto = new Set(
        cProtos.filter((p) => p.stage === "aprovado" && p.product_id).map((p) => p.product_id!)
      );
      const semPiloto = cProducts.filter((p) => !productsWithApprovedProto.has(p.id)).length;
      const protoPendentes = cProtos.filter((p) => p.stage !== "aprovado" && p.stage !== "reprovado").length;
      const opsAguardando = cOrders.filter((o) => o.status === "aguardando").length;
      const liberadosPCP = cOrders.filter((o) => o.stage !== "cad" && o.stage !== "entregue").length;
      const totalQty = cOrders.reduce((a, o) => a + o.quantity, 0);
      const avanco = totalQty > 0 ? (producedQty / totalQty) * 100 : 0;

      const approvedSheetIds = new Set(sheets.filter(s => s.status === "aprovada" && s.product_id).map(s => s.product_id!));
      const semFicha = cProducts.filter(p => !approvedSheetIds.has(p.id)).length;

      // Champions e críticos por receita
      const revenuePerProduct = new Map<string, number>();
      cSales.forEach(s => { if (s.product_id) revenuePerProduct.set(s.product_id, (revenuePerProduct.get(s.product_id) ?? 0) + Number(s.total ?? 0)); });
      const ranked = cProducts.map(p => ({ p, rev: revenuePerProduct.get(p.id) ?? 0 })).sort((a,b) => b.rev - a.rev);
      const champions = ranked.slice(0, 3).filter(x => x.rev > 0);
      const criticos = ranked.filter(x => x.rev === 0).slice(0, 3);

      return {
        collection: c,
        productCount: cProducts.length,
        protoCount: cProtos.length,
        protoApproved: cProtos.filter((p) => p.stage === "aprovado").length,
        opsActive, opsDone, producedQty,
        revenue, unitsSold, margin, sellThrough,
        investment, profit, roi,
        semPiloto, protoPendentes, opsAguardando, liberadosPCP, avanco,
        semFicha, champions, criticos,
      };
    });
  }, [collections, products, prototypes, orders, sales, sheets]);

  const current = summary.find((s) => s.collection.id === currentId) ?? summary[0];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Compass className="size-6 text-primary" />Coleção 360º
        </h1>
        <p className="text-sm text-muted-foreground">
          Ciclo completo da coleção — do protótipo à margem real, em uma única tela.
        </p>
      </header>

      {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : collections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma coleção cadastrada.
          <Link to="/colecoes" className="ml-2 text-primary hover:underline">Criar coleção →</Link>
        </div>
      ) : (
        <>
          {/* Seletor de coleções */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {summary.map((s) => (
              <button
                key={s.collection.id}
                onClick={() => setSelectedId(s.collection.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg border text-left transition-colors ${
                  s.collection.id === current?.collection.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.collection.season ?? "—"} {s.collection.year ?? ""}
                </div>
                <div className="font-medium text-sm">{s.collection.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {s.productCount} prod · {s.opsActive} OPs
                </div>
              </button>
            ))}
          </div>

          {current && (
            <>
              {/* Pipeline visual */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pipeline da coleção</div>
                <div className="flex items-stretch gap-2 overflow-x-auto">
                  <Stage icon={<Sparkles className="size-4" />} label="Protótipos" value={current.protoCount} sub={`${current.protoApproved} aprovados`} to="/prototipos" />
                  <Arrow />
                  <Stage icon={<Layers className="size-4" />} label="Produtos" value={current.productCount} sub="liberados" to="/produtos" />
                  <Arrow />
                  <Stage icon={<Scissors className="size-4" />} label="OPs ativas" value={current.opsActive} sub={`${current.opsDone} entregues`} to="/pcp-kanban" />
                  <Arrow />
                  <Stage icon={<Factory className="size-4" />} label="Produzido" value={current.producedQty} sub="unidades" to="/twin-factory" />
                  <Arrow />
                  <Stage icon={<Package className="size-4" />} label="Vendido" value={current.unitsSold} sub="unidades" to="/sales-performance" />
                </div>
              </div>

              {/* IA Coordenador — diagnóstico em linguagem natural */}
              <CoordinatorBriefing c={current} />

              {/* Sala de Guerra — sinais operacionais */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Radio className="size-3.5 text-primary" /> Sala de Guerra
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Avanço da produção: <span className="font-semibold text-foreground tabular-nums">{Math.round(current.avanco)}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <WarKPI label="Sem piloto aprovado" value={current.semPiloto} icon={<FileWarning className="size-3.5" />} tone={current.semPiloto > 0 ? "red" : "green"} to="/prototipos" />
                  <WarKPI label="Sem ficha técnica" value={current.semFicha} icon={<FileWarning className="size-3.5" />} tone={current.semFicha > 0 ? "red" : "green"} to="/tech-sheets" />
                  <WarKPI label="Protótipos pendentes" value={current.protoPendentes} icon={<Sparkles className="size-3.5" />} tone={current.protoPendentes > 5 ? "yellow" : "neutral"} to="/dev-kanban" />
                  <WarKPI label="OPs aguardando" value={current.opsAguardando} icon={<Clock className="size-3.5" />} tone={current.opsAguardando > 0 ? "yellow" : "green"} to="/pcp-kanban" />
                  <WarKPI label="Liberados p/ PCP" value={current.liberadosPCP} icon={<CheckCircle2 className="size-3.5" />} tone="primary" to="/pcp-kanban" />
                  <WarKPI label="OPs em atraso" value={Math.max(0, current.opsActive - current.liberadosPCP - current.opsAguardando)} icon={<AlertTriangle className="size-3.5" />} tone="neutral" to="/twin-factory" />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, current.avanco)}%` }} />
                </div>
              </div>

              {/* Champions e críticos */}
              {(current.champions.length > 0 || current.criticos.length > 0) && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-success/30 bg-card p-4">
                    <div className="text-xs uppercase tracking-wider text-success mb-2 flex items-center gap-1.5"><TrendingUp className="size-3.5" /> Campeões da coleção</div>
                    {current.champions.length === 0 ? <div className="text-xs text-muted-foreground">Sem dados de venda.</div> : (
                      <ul className="space-y-1.5">
                        {current.champions.map(({ p, rev }) => (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="truncate"><span className="text-muted-foreground text-xs">{p.sku}</span> · {p.name}</span>
                            <span className="tabular-nums font-medium">R$ {(rev/1000).toFixed(1)}k</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-destructive/30 bg-card p-4">
                    <div className="text-xs uppercase tracking-wider text-destructive mb-2 flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> Críticos (sem venda)</div>
                    {current.criticos.length === 0 ? <div className="text-xs text-muted-foreground">Todos os produtos têm venda.</div> : (
                      <ul className="space-y-1.5">
                        {current.criticos.map(({ p }) => (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="truncate"><span className="text-muted-foreground text-xs">{p.sku}</span> · {p.name}</span>
                            <span className="text-xs text-muted-foreground">{p.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* KPIs financeiros */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Receita" value={`R$ ${(current.revenue / 1000).toFixed(1)}k`} icon={<DollarSign className="size-4" />} tone="primary" />
                <KPI label="Margem média" value={`${Math.round(current.margin)}%`} icon={<Percent className="size-4" />} tone={current.margin >= 40 ? "green" : current.margin >= 20 ? "yellow" : "red"} />
                <KPI label="Sell-through" value={`${Math.round(current.sellThrough)}%`} icon={<TrendingUp className="size-4" />} tone={current.sellThrough >= 70 ? "green" : current.sellThrough >= 40 ? "yellow" : "red"} />
                <KPI label="Status" value={current.collection.status} icon={<Compass className="size-4" />} tone="primary" />
              </div>

              {/* Atalhos cruzados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Shortcut to="/colecoes" label="Editar coleção" />
                <Shortcut to="/product-score" label="Score por produto" />
                <Shortcut to="/profitability" label="Rentabilidade (ERP)" />
                <Shortcut to="/marketing" label="Marketing da coleção" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stage({ icon, label, value, sub, to }: { icon: React.ReactNode; label: string; value: number; sub: string; to: string }) {
  return (
    <Link to={to} className="flex-1 min-w-[110px] rounded-lg border border-border bg-muted/20 p-3 hover:border-primary transition-colors">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </Link>
  );
}

function Arrow() {
  return <div className="flex items-center text-muted-foreground/40"><ArrowRight className="size-4" /></div>;
}

function KPI({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "red" | "yellow" | "green" | "primary" }) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 bg-card ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function WarKPI({ label, value, icon, tone, to }: { label: string; value: number; icon: React.ReactNode; tone: "red" | "yellow" | "green" | "primary" | "neutral"; to: string }) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
    neutral: "border-border text-muted-foreground",
  };
  return (
    <Link to={to} className={`rounded-lg border bg-muted/10 p-2.5 hover:bg-muted/30 transition-colors ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5 text-foreground">{value}</div>
    </Link>
  );
}

function Shortcut({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary hover:bg-muted/30 transition-colors flex items-center justify-between">
      <span>{label}</span><ArrowRight className="size-3 text-muted-foreground" />
    </Link>
  );
}

function CoordinatorBriefing({ c }: { c: any }) {
  const alerts: string[] = [];
  if (c.semPiloto > 0) alerts.push(`${c.semPiloto} produto${c.semPiloto > 1 ? "s" : ""} sem piloto aprovado`);
  if (c.semFicha > 0) alerts.push(`${c.semFicha} sem ficha técnica`);
  if (c.protoPendentes > 5) alerts.push(`${c.protoPendentes} protótipos pendentes`);
  if (c.opsAguardando > 0) alerts.push(`${c.opsAguardando} OPs aguardando liberação`);

  const verdict =
    alerts.length === 0 && c.avanco >= 80
      ? { tone: "success", label: "Coleção saudável", msg: `Avanço de ${Math.round(c.avanco)}% e sem bloqueios — siga com o ritmo atual.` }
      : alerts.length >= 3 || c.semPiloto > 3
      ? { tone: "destructive", label: "Coleção em risco", msg: `Atenção: ${alerts.slice(0, 3).join(", ")}. Priorize destravar pilotos e fichas antes de abrir novas OPs.` }
      : alerts.length > 0
      ? { tone: "warning", label: "Pontos de atenção", msg: `${alerts.slice(0, 3).join(" · ")}. Ajustar nesta semana mantém o cronograma.` }
      : { tone: "primary", label: "Coleção em ritmo", msg: `Pipeline rodando com avanço de ${Math.round(c.avanco)}%. Acompanhar gargalos da produção.` };

  const tones: Record<string, string> = {
    success: "border-success/40 bg-success/5",
    destructive: "border-destructive/40 bg-destructive/5",
    warning: "border-warning/40 bg-warning/5",
    primary: "border-primary/40 bg-primary/5",
  };
  const labelTones: Record<string, string> = {
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-primary",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[verdict.tone]}`}>
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-lg bg-[image:var(--gradient-primary)] grid place-items-center flex-shrink-0 shadow-[var(--shadow-glow)]">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Coordenador de Desenvolvimento · IA</div>
          <div className={`text-sm font-semibold ${labelTones[verdict.tone]} mt-0.5`}>{verdict.label}</div>
          <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{verdict.msg}</p>
          {c.champions[0] && (
            <p className="text-xs text-muted-foreground mt-2">
              Campeão da coleção: <span className="text-foreground font-medium">{c.champions[0].p.name}</span> ({c.champions[0].p.sku}) — R$ {(c.champions[0].rev / 1000).toFixed(1)}k em vendas. Considere reforçar produção.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
