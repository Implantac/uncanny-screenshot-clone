import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Database, Layers as LayersIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/data-lake")({ component: DataLake });

const DOMAINS = [
  { key: "products", label: "Produtos", color: "bg-violet-500" },
  { key: "collections", label: "Coleções", color: "bg-blue-500" },
  { key: "production_orders", label: "Ordens de Produção", color: "bg-amber-500" },
  { key: "prototypes", label: "Protótipos", color: "bg-pink-500" },
  { key: "inventory_items", label: "Estoque", color: "bg-emerald-500" },
  { key: "sales", label: "Vendas", color: "bg-cyan-500" },
  { key: "b2b_orders", label: "Pedidos B2B", color: "bg-indigo-500" },
  { key: "marketing_campaigns", label: "Campanhas", color: "bg-rose-500" },
  { key: "influencers", label: "Influenciadores", color: "bg-fuchsia-500" },
  { key: "suppliers", label: "Fornecedores", color: "bg-orange-500" },
  { key: "financial_accounts", label: "Financeiro", color: "bg-lime-500" },
  { key: "tech_sheets", label: "Fichas Técnicas", color: "bg-slate-500" },
] as const;

type DomainKey = (typeof DOMAINS)[number]["key"];

async function load() {
  const results = await Promise.all(
    DOMAINS.map(async (d) => {
      const { count } = await supabase.from(d.key).select("*", { count: "exact", head: true });
      return [d.key, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<DomainKey, number>;
}

function DataLake() {
  const { data, isLoading } = useQuery({ queryKey: ["data-lake"], queryFn: load });
  const counts = data ?? ({} as Record<DomainKey, number>);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Data Lake — Visão Unificada</h1>
        <p className="text-sm text-muted-foreground">
          Camada analítica que consolida todos os domínios da plataforma — base para IA, BI e
          relatórios LGPD.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          icon={Database}
          label="Registros totais"
          value={isLoading ? "…" : total.toLocaleString("pt-BR")}
        />
        <Kpi icon={LayersIcon} label="Domínios mapeados" value={String(DOMAINS.length)} />
        <Kpi
          icon={Database}
          label="Maior domínio"
          value={isLoading ? "…" : (DOMAINS.find((d) => counts[d.key] === max)?.label ?? "—")}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Volume por domínio</h2>
        <div className="space-y-3">
          {DOMAINS.map((d) => {
            const c = counts[d.key] ?? 0;
            const pct = (c / max) * 100;
            return (
              <div key={d.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {c.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${d.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOMAINS.map((d) => (
          <div key={d.key} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${d.color}`} />
              <span className="text-sm font-medium">{d.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {isLoading ? "…" : (counts[d.key] ?? 0).toLocaleString("pt-BR")}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">public.{d.key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
