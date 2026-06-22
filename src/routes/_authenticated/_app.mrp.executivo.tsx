import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Briefcase,
  ShoppingCart,
  Factory,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  PackageX,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMrpExecKpis,
  generateMrpInsights,
  type Persona,
  type MrpExecKpis,
} from "@/lib/mrp-insights.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/mrp/executivo")({
  head: () => ({
    meta: [
      { title: "MRP Executivo · USE MODA PLM" },
      {
        name: "description",
        content: "Dashboard executivo MRP com insights de IA por persona (Diretor, Comprador, PCP, Financeiro).",
      },
    ],
  }),
  component: MrpExecPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

const PERSONAS: { key: Persona; label: string; icon: typeof Briefcase; desc: string }[] = [
  { key: "diretor", label: "Diretor", icon: Briefcase, desc: "Visão estratégica e KPIs" },
  { key: "comprador", label: "Comprador", icon: ShoppingCart, desc: "O que comprar agora" },
  { key: "pcp", label: "PCP", icon: Factory, desc: "Risco de ruptura" },
  { key: "financeiro", label: "Financeiro", icon: Wallet, desc: "Capital e giro" },
];

function MrpExecPage() {
  const kpisFn = useServerFn(getMrpExecKpis);
  const insightsFn = useServerFn(generateMrpInsights);
  const [persona, setPersona] = useState<Persona>("diretor");
  const [insights, setInsights] = useState<string | null>(null);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["mrp-exec-kpis"],
    queryFn: () => kpisFn({}),
    staleTime: 60_000,
  });

  const askAi = useMutation({
    mutationFn: (p: Persona) => insightsFn({ data: { persona: p } }),
    onSuccess: (r) => {
      setInsights(r.insights);
    },
    onError: (e) => toast.error((e as Error).message || "Falha ao consultar IA"),
  });

  const handlePersona = (p: Persona) => {
    setPersona(p);
    setInsights(null);
    askAi.mutate(p);
  };

  if (isLoading || !kpis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/mrp">
              <ArrowLeft className="h-4 w-4 mr-1" /> MRP
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> MRP Executivo
          </h1>
          <p className="text-sm text-muted-foreground">
            Dashboard estratégico com insights de IA por persona.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/mrp/bi">Ver BI MRP</Link>
        </Button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Valor em estoque"
          value={brl(kpis.totalStockValue)}
          sub={`${kpis.totalSkus} SKUs · abrir MRP`}
          to="/mrp"
        />
        <Kpi
          label="Capital parado"
          value={brl(kpis.capitalParado)}
          sub={`${kpis.capitalParadoPct.toFixed(1)}% · ver excesso`}
          tone="warning"
          icon={<TrendingDown className="size-4 text-amber-500" />}
          to="/mrp"
          search={{ status: "excesso" }}
        />
        <Kpi
          label="Itens críticos"
          value={String(kpis.itemsCritical)}
          sub={`${kpis.rupturas} em ruptura · ver críticos`}
          tone="danger"
          icon={<AlertTriangle className="size-4 text-destructive" />}
          to="/mrp"
          search={{ status: "critico" }}
        />
        <Kpi
          label="Excesso"
          value={String(kpis.itemsExcess)}
          sub="acima do máximo · ver lista"
          tone="info"
          icon={<TrendingUp className="size-4 text-blue-500" />}
          to="/mrp"
          search={{ status: "excesso" }}
        />
        <Kpi
          label="Cobertura média"
          value={kpis.avgCoverage !== null ? `${kpis.avgCoverage}d` : "—"}
          sub="dias · ver em atenção"
          to="/mrp"
          search={{ status: "atencao" }}
        />
        <Kpi label="Giro médio" value={num(kpis.giroMedio, 2)} sub="anual / estoque médio" to="/mrp/bi" />
        <Kpi
          label="Compras sugeridas"
          value={brl(kpis.suggestedValue)}
          sub={`${kpis.suggestedItems} itens · planejar`}
          to="/mrp"
          search={{ status: "critico" }}
        />
        <Kpi
          label="Fornecedores"
          value={String(kpis.bySupplier.length)}
          sub="ativos · ver BI"
          to="/mrp/bi"
        />
      </div>


      {/* Persona selector */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Insights por persona</h2>
            <p className="text-xs text-muted-foreground">
              A IA analisa os dados reais e gera recomendações sob a ótica de cada papel.
            </p>
          </div>
          {insights && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => askAi.mutate(persona)}
              disabled={askAi.isPending}
            >
              <RefreshCw className={`size-4 ${askAi.isPending ? "animate-spin" : ""}`} /> Regenerar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const active = persona === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handlePersona(p.key)}
                className={`p-3 rounded-md border text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4 mb-1" />
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="rounded-md bg-muted/30 p-4 min-h-[200px]">
          {askAi.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Analisando dados sob a ótica de {PERSONAS.find((p) => p.key === persona)?.label}…
            </div>
          )}
          {!askAi.isPending && !insights && (
            <div className="text-sm text-muted-foreground">
              <Sparkles className="size-4 inline mr-1" />
              Escolha uma persona acima para gerar insights personalizados.
            </div>
          )}
          {!askAi.isPending && insights && (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Top lists feeding the IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopList
          title="Top compras sugeridas"
          icon={<ShoppingCart className="size-4" />}
          items={kpis.topBuy.map((r) => ({
            primary: r.sku,
            secondary: r.name,
            tertiary: r.supplier ?? "sem fornecedor",
            value: brl(r.value),
          }))}
        />
        <TopList
          title="Críticos (risco ruptura)"
          icon={<PackageX className="size-4 text-destructive" />}
          items={kpis.topCritical.map((r) => ({
            primary: r.sku,
            secondary: r.name,
            tertiary: r.coverage !== null ? `${r.coverage}d cobertura` : "sem histórico",
            value: r.suggested ? `Sug. ${num(r.suggested)}` : "—",
          }))}
        />
        <TopList
          title="Excesso (capital parado)"
          icon={<TrendingUp className="size-4 text-blue-500" />}
          items={kpis.topExcess.map((r) => ({
            primary: r.sku,
            secondary: r.name,
            tertiary: r.coverage !== null ? `${r.coverage}d cobertura` : "—",
            value: brl(r.capital),
          }))}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warning" | "danger" | "info";
  icon?: React.ReactNode;
}) {
  const toneCls =
    tone === "warning"
      ? "border-amber-500/30"
      : tone === "danger"
        ? "border-destructive/30"
        : tone === "info"
          ? "border-blue-500/30"
          : "";
  return (
    <div className={`rounded-lg border bg-card p-4 ${toneCls}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function TopList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { primary: string; secondary: string; tertiary: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Nenhum item.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{it.primary}</div>
                <div className="text-xs text-muted-foreground truncate">{it.secondary}</div>
                <div className="text-[11px] text-muted-foreground">{it.tertiary}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums whitespace-nowrap">{it.value}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
