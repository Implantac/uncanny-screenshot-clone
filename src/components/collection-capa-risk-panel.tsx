import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertOctagon, ShieldAlert, Calendar, TrendingDown } from "lucide-react";
import { getCollectionCapaRisks } from "@/lib/collection-capa-risk.functions";
import { Markdown } from "@/components/markdown";
import { Link } from "@tanstack/react-router";

export function CollectionCapaRiskPanel() {
  const fn = useServerFn(getCollectionCapaRisks);
  const { data, isLoading } = useQuery({
    queryKey: ["collection-capa-risks"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;
  if (data.rows.length === 0) return null;

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-destructive" />
        <div className="font-medium text-sm">Qualidade → Coleção</div>
        <span className="text-xs text-muted-foreground">
          — CAPAs recorrentes afetando lançamentos
        </span>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span>{data.summary.collectionsAtRisk} em risco</span>
          <span>{data.summary.totalOpenCapas} CAPAs abertas</span>
          <span>{data.summary.totalRecurrent} recorrentes</span>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown content={data.insight} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {data.rows.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Link
                to="/colecao-360/$id"
                params={{ id: r.id }}
                className="font-medium hover:underline truncate"
              >
                {r.name}
              </Link>
              <span
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  r.riskLabel === "critico"
                    ? "bg-destructive/15 text-destructive"
                    : r.riskLabel === "atencao"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-emerald-500/15 text-emerald-600"
                }`}
              >
                {r.riskLabel} · {r.riskScore}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-3 flex-wrap">
              {r.daysToLaunch !== null && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {r.daysToLaunch}d
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <AlertOctagon className="size-3" />
                {r.openCapas}/{r.totalCapas} CAPAs
              </span>
              {r.recurrentCapas > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <TrendingDown className="size-3" />
                  {r.recurrentCapas} recorrentes
                </span>
              )}
            </div>
            <div className="text-muted-foreground/90 prose prose-xs dark:prose-invert max-w-none [&_p]:my-0">
              <Markdown content={r.recommendation} />
            </div>
            {r.products.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {r.products.map((p) => (
                  <Link
                    key={p.productId}
                    to="/produto/$id"
                    params={{ id: p.productId }}
                    className="text-[10px] font-mono border border-border rounded px-1.5 py-0.5 hover:bg-muted"
                    title={`${p.capaCount} CAPAs · fornecedor: ${p.suppliers[0]?.name ?? "—"}`}
                  >
                    {p.productSku ?? p.productName ?? p.productId.slice(0, 6)}
                    <span className="ml-1 text-destructive">×{p.capaCount}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
