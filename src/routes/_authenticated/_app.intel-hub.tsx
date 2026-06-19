import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  Brain,
  AlertTriangle,
  Clock,
  Factory,
  Zap,
  Trophy,
  Star,
  Boxes,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  PackageSearch,
  Megaphone,
  Users,
  DollarSign,
} from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { AskFashionAI } from "@/components/ask-fashion-ai";

export const Route = createFileRoute("/_authenticated/_app/intel-hub")({
  head: () => ({
    meta: [
      { title: "Inteligência Operacional · USE MODA PLM" },
      {
        name: "description",
        content: "Hub unificado de alertas, reposição técnica e scores do PLM.",
      },
    ],
  }),
  component: IntelHub,
});

type Order = {
  id: string;
  code: string;
  stage: string;
  status: string;
  quantity: number;
  due_date: string | null;
  priority: number;
  stage_updated_at: string;
  batch_code: string | null;
  products: { name: string; sku: string } | null;
  suppliers: { name: string } | null;
};
type Batch = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  planned_quantity: number | null;
  produced_quantity: number | null;
  updated_at: string;
};
type Product = {
  id: string;
  name: string;
  sku: string;
  cost_price: number | null;
  sale_price: number | null;
  status: string;
};
type Supplier = {
  id: string;
  name: string;
  rating: number | null;
  on_time_delivery_rate: number | null;
};

async function loadAll() {
  const today = new Date().toISOString().slice(0, 10);
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [orders, batches, products, suppliers, campaigns, shipments, briefs] = await Promise.all([
    supabase
      .from("production_orders")
      .select(
        "id, code, stage, status, quantity, due_date, priority, stage_updated_at, batch_code, products(name, sku), suppliers(name)",
      )
      .neq("status", "cancelada")
      .limit(500),
    supabase
      .from("production_batches")
      .select("id, code, name, status, planned_quantity, produced_quantity, updated_at")
      .in("status", ["planejado", "em_producao"])
      .limit(50),
    supabase
      .from("products")
      .select("id, name, sku, cost_price, sale_price, status")
      .eq("status", "aprovado")
      .limit(200),
    supabase.from("suppliers").select("id, name, rating, on_time_delivery_rate").limit(100),
    supabase
      .from("marketing_campaigns")
      .select("id, name, channel, status, investment, revenue, roas, start_date, end_date")
      .limit(100),
    supabase
      .from("influencer_shipments")
      .select("id, status, posted_at, sales_before, sales_after, influencers(nome, seguidores, engajamento)")
      .gte("created_at", since30)
      .limit(200),
    supabase
      .from("marketing_briefs")
      .select("id, title, status, kpi_target, budget, updated_at")
      .neq("status", "arquivado")
      .limit(50),
  ]);
  return {
    orders: (orders.data ?? []) as unknown as Order[],
    batches: (batches.data ?? []) as unknown as Batch[],
    products: (products.data ?? []) as unknown as Product[],
    suppliers: (suppliers.data ?? []) as unknown as Supplier[],
    campaigns: (campaigns.data ?? []) as any[],
    shipments: (shipments.data ?? []) as any[],
    briefs: (briefs.data ?? []) as any[],
    today,
  };
}

function IntelHub() {
  useRealtime("production_orders", ["intel-hub"]);
  useRealtime("production_batches", ["intel-hub"]);
  const { data, isLoading } = useQuery({ queryKey: ["intel-hub"], queryFn: loadAll });
  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const batches = useMemo(() => data?.batches ?? [], [data?.batches]);
  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const suppliers = useMemo(() => data?.suppliers ?? [], [data?.suppliers]);
  const campaigns = useMemo(() => data?.campaigns ?? [], [data?.campaigns]);
  const shipments = useMemo(() => data?.shipments ?? [], [data?.shipments]);
  const briefs = useMemo(() => data?.briefs ?? [], [data?.briefs]);

  const now = Date.now();
  const alerts = useMemo(() => {
    const overdue = orders.filter(
      (o) => o.stage !== "entregue" && o.due_date && new Date(o.due_date).getTime() < now,
    );
    const dueSoon = orders.filter(
      (o) =>
        o.stage !== "entregue" &&
        o.due_date &&
        new Date(o.due_date).getTime() >= now &&
        new Date(o.due_date).getTime() - now < 7 * 86400000,
    );
    const stuckOrders = orders.filter(
      (o) => o.stage !== "entregue" && now - new Date(o.stage_updated_at).getTime() > 5 * 86400000,
    );
    const stuckBatches = batches.filter(
      (b) => now - new Date(b.updated_at).getTime() > 7 * 86400000,
    );
    const stageCounts = new Map<string, number>();
    orders
      .filter((o) => o.stage !== "entregue")
      .forEach((o) => stageCounts.set(o.stage, (stageCounts.get(o.stage) ?? 0) + o.quantity));
    const bottleneck = [...stageCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { overdue, dueSoon, stuckOrders, stuckBatches, bottleneck };
  }, [orders, batches, now]);

  // Reposição técnica: produtos sem OP ativa
  const replenishment = useMemo(() => {
    const productsWithActiveOP = new Set(
      orders
        .filter((o) => o.stage !== "entregue")
        .map((o) => o.products?.sku)
        .filter(Boolean),
    );
    return products
      .filter((p) => !productsWithActiveOP.has(p.sku))
      .slice(0, 8)
      .map((p) => ({
        ...p,
        margin:
          p.sale_price && p.cost_price
            ? ((p.sale_price - p.cost_price) / p.sale_price) * 100
            : null,
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

  // Marketing Intelligence — cruza campanhas + influenciadores + briefs
  const marketing = useMemo(() => {
    const activeCampaigns = campaigns.filter((c) => c.status === "ativa" || c.status === "ativo");
    const totalInvest = campaigns.reduce((s, c) => s + Number(c.investment ?? 0), 0);
    const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue ?? 0), 0);
    const blendedRoas = totalInvest > 0 ? totalRevenue / totalInvest : 0;
    const topRoas = [...campaigns]
      .filter((c) => Number(c.roas ?? 0) > 0)
      .sort((a, b) => Number(b.roas ?? 0) - Number(a.roas ?? 0))[0];
    const worstRoas = [...campaigns]
      .filter((c) => Number(c.investment ?? 0) > 0 && Number(c.roas ?? 0) > 0)
      .sort((a, b) => Number(a.roas ?? 0) - Number(b.roas ?? 0))[0];

    // ROI por influenciador via vendas_antes/depois nos envios
    const infRoi = shipments
      .filter((s) => s.posted_at && (s.sales_after ?? 0) > (s.sales_before ?? 0))
      .map((s) => ({
        nome: s.influencers?.nome ?? "—",
        delta: (s.sales_after ?? 0) - (s.sales_before ?? 0),
        seguidores: s.influencers?.seguidores ?? 0,
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4);

    const draftBriefs = briefs.filter((b) => b.status === "rascunho" || b.status === "draft").length;

    // insights acionáveis
    const insights: Array<{ tone: "ok" | "warn" | "info" | "danger"; title: string; reason: string }> = [];
    if (blendedRoas >= 3) {
      insights.push({
        tone: "ok",
        title: `ROAS blended ${blendedRoas.toFixed(2)}x — verba performando`,
        reason: `Receita ${totalRevenue.toLocaleString("pt-BR")} sobre investimento ${totalInvest.toLocaleString("pt-BR")}. Considere escalar a campanha com maior retorno.`,
      });
    } else if (blendedRoas > 0 && blendedRoas < 1.5) {
      insights.push({
        tone: "danger",
        title: `ROAS blended ${blendedRoas.toFixed(2)}x abaixo do limite saudável`,
        reason: `Pause campanhas com ROAS < 1.5 e realoque para o canal vencedor. Investimento atual: ${totalInvest.toLocaleString("pt-BR")}.`,
      });
    }
    if (worstRoas && Number(worstRoas.roas ?? 0) < 1.5) {
      insights.push({
        tone: "warn",
        title: `"${worstRoas.name}" com ROAS ${Number(worstRoas.roas).toFixed(2)}x`,
        reason: `Canal ${worstRoas.channel ?? "—"} consumiu ${Number(worstRoas.investment ?? 0).toLocaleString("pt-BR")} sem retorno proporcional. Reduza ou redirecione verba.`,
      });
    }
    if (topRoas) {
      insights.push({
        tone: "info",
        title: `Vencedor: "${topRoas.name}" (${Number(topRoas.roas).toFixed(2)}x)`,
        reason: `Replique criativo/segmentação nas próximas campanhas do canal ${topRoas.channel ?? "—"}.`,
      });
    }
    if (draftBriefs >= 3) {
      insights.push({
        tone: "warn",
        title: `${draftBriefs} brief(s) em rascunho`,
        reason: `Briefs parados atrasam lançamentos. Revise e aprove para destravar produção de conteúdo.`,
      });
    }

    return {
      activeCampaigns: activeCampaigns.length,
      totalInvest,
      totalRevenue,
      blendedRoas,
      topRoas,
      worstRoas,
      infRoi,
      draftBriefs,
      insights: insights.slice(0, 4),
    };
  }, [campaigns, shipments, briefs]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Brain className="size-6 text-primary" />
            Inteligência Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Hub unificado: alertas, reposição técnica e scores — sinais que o PCP precisa agir.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/intelligence"
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted"
          >
            Intelligence Engine
          </Link>
          <Link
            to="/control-tower"
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted"
          >
            Control Tower
          </Link>
        </div>
      </header>

      <AskFashionAI />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI
          label="OPs atrasadas"
          value={alerts.overdue.length}
          icon={<AlertTriangle className="size-4" />}
          tone="red"
          to="/twin-factory"
        />
        <KPI
          label="Vencem em 7d"
          value={alerts.dueSoon.length}
          icon={<Clock className="size-4" />}
          tone="yellow"
          to="/pcp-kanban"
        />
        <KPI
          label="OPs paradas >5d"
          value={alerts.stuckOrders.length}
          icon={<Factory className="size-4" />}
          tone="primary"
          to="/pcp-kanban"
        />
        <KPI
          label="Lotes inertes"
          value={alerts.stuckBatches.length}
          icon={<Boxes className="size-4" />}
          tone="primary"
          to="/lotes"
        />
        <KPI
          label="Gargalo"
          value={alerts.bottleneck?.[0] ?? "—"}
          icon={<TrendingUp className="size-4" />}
          tone="primary"
          to="/twin-factory"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 text-destructive" />
              Alertas operacionais
            </div>
            <Link
              to="/twin-factory"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Torre <ArrowRight className="size-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : alerts.overdue.length === 0 && alerts.stuckOrders.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sem alertas críticos. ✅</div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.overdue.slice(0, 5).map((o) => (
                <li
                  key={o.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-destructive">{o.code} · atrasada</div>
                    <div className="truncate text-muted-foreground">
                      {o.products?.name ?? "—"} · {o.suppliers?.name ?? "sem fornecedor"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {Math.ceil((now - new Date(o.due_date!).getTime()) / 86400000)}d
                  </div>
                </li>
              ))}
              {alerts.stuckOrders.slice(0, 3).map((o) => (
                <li
                  key={o.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-orange-500">
                      {o.code} · parada em {o.stage}
                    </div>
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
            <div className="flex items-center gap-2 font-medium">
              <Zap className="size-4 text-primary" />
              Reposição técnica sugerida
            </div>
            <Link
              to="/replenishment"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Ver tudo <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border bg-muted/20">
            Produtos ativos sem OP em andamento — candidatos a nova ordem de produção.
          </div>
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : replenishment.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Todos os produtos ativos têm OP em andamento. ✅
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {replenishment.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.margin !== null && (
                      <span
                        className={`text-xs tabular-nums ${p.margin >= 40 ? "text-success" : p.margin >= 20 ? "text-warning" : "text-destructive"}`}
                      >
                        {Math.round(p.margin)}% mg
                      </span>
                    )}
                    <Link
                      to="/pcp"
                      className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Criar OP
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Supplier score */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <Trophy className="size-4 text-warning" />
              Top fornecedores
            </div>
            <Link
              to="/supplier-score"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Scorecard <ArrowRight className="size-3" />
            </Link>
          </div>
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : supplierScore.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sem dados de fornecedores.</div>
          ) : (
            <ul className="divide-y divide-border">
              {supplierScore.map((s) => (
                <li
                  key={s.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 truncate">{s.name}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      OTD {Math.round((s.on_time_delivery_rate ?? 0) * 100)}%
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${s.score >= 70 ? "text-success" : s.score >= 40 ? "text-warning" : "text-destructive"}`}
                    >
                      {s.score}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Atalhos de inteligência */}
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 font-medium">
            <Star className="size-4 text-primary" />
            Inteligência cruzada
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            <ShortcutLink
              to="/product-score"
              icon={<Star className="size-4" />}
              title="Product Score"
              hint="Pontuação 0–100"
            />
            <ShortcutLink
              to="/product-success"
              icon={<TrendingUp className="size-4" />}
              title="Product Success"
              hint="Probabilidade"
            />
            <ShortcutLink
              to="/grade-needs"
              icon={<PackageSearch className="size-4" />}
              title="Necessidade por grade"
              hint="PP/P/M/G/GG"
            />
            <ShortcutLink
              to="/control-tower"
              icon={<Factory className="size-4" />}
              title="Control Tower"
              hint="Demand & supply"
            />
          </div>
        </section>
      </div>

      {/* MARKETING INTELLIGENCE — IA Marketing cruzando campanhas + influenciadores + briefs */}
      <section className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-fuchsia-600" />
            <h2 className="font-semibold">Marketing Intelligence</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              IA Marketing — onde a verba está performando
            </span>
          </div>
          <div className="flex gap-2">
            <Link to="/campaigns" className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-muted">
              Campanhas
            </Link>
            <Link to="/influencer-roi" className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-muted">
              ROI Influenciadores
            </Link>
            <Link to="/attribution" className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-muted">
              Attribution
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniKpi label="Campanhas ativas" value={marketing.activeCampaigns} icon={<Megaphone className="size-3.5" />} tone="primary" />
          <MiniKpi
            label="Investimento"
            value={`R$ ${(marketing.totalInvest / 1000).toFixed(1)}k`}
            icon={<DollarSign className="size-3.5" />}
            tone="primary"
          />
          <MiniKpi
            label="Receita atribuída"
            value={`R$ ${(marketing.totalRevenue / 1000).toFixed(1)}k`}
            icon={<TrendingUp className="size-3.5" />}
            tone={marketing.totalRevenue >= marketing.totalInvest ? "green" : "yellow"}
          />
          <MiniKpi
            label="ROAS blended"
            value={`${marketing.blendedRoas.toFixed(2)}x`}
            icon={marketing.blendedRoas >= 2 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            tone={marketing.blendedRoas >= 2 ? "green" : marketing.blendedRoas >= 1.5 ? "yellow" : "red"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Insights IA Marketing */}
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Brain className="size-3.5" /> IA Marketing — sugestões
            </div>
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Carregando…</div>
            ) : marketing.insights.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sem dados de campanhas suficientes para gerar insights.</div>
            ) : (
              <ul className="space-y-2">
                {marketing.insights.map((ins, i) => {
                  const tones: Record<string, string> = {
                    ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
                    warn: "border-amber-500/30 bg-amber-500/5 text-amber-700",
                    danger: "border-red-500/30 bg-red-500/5 text-red-700",
                    info: "border-sky-500/30 bg-sky-500/5 text-sky-700",
                  };
                  return (
                    <li key={i} className={`rounded border p-2 ${tones[ins.tone]}`}>
                      <div className="text-xs font-semibold">{ins.title}</div>
                      <div className="text-[11px] text-foreground/80 mt-0.5">{ins.reason}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Top influenciadores ROI */}
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Users className="size-3.5" /> Top influenciadores (Δ vendas)
            </div>
            {marketing.infRoi.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sem envios com retorno medido nos últimos 30 dias.</div>
            ) : (
              <ul className="space-y-1.5">
                {marketing.infRoi.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(r.seguidores / 1000).toFixed(0)}k seguidores
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-600">+{r.delta.toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            )}
            {marketing.draftBriefs > 0 && (
              <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                {marketing.draftBriefs} brief(s) em rascunho —{" "}
                <Link to="/marketing" className="text-primary hover:underline">
                  revisar
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "red" | "yellow" | "green" | "primary";
}) {
  const tones = {
    red: "border-destructive/30 text-destructive",
    yellow: "border-warning/30 text-warning",
    green: "border-success/30 text-success",
    primary: "border-primary/30 text-primary",
  };
  return (
    <div className={`rounded-lg border bg-card p-2.5 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  tone,
  to,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "red" | "yellow" | "green" | "primary";
  to: string;
}) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <Link
      to={to}
      className={`rounded-xl border p-4 bg-card hover:bg-muted/30 transition-colors ${tones[tone]}`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Link>
  );
}

function ShortcutLink({
  to,
  icon,
  title,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border bg-muted/20 p-3 hover:border-primary transition-colors"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </Link>
  );
}
