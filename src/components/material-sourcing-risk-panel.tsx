import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Factory, Calendar, AlertOctagon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMaterialSourcingRisks } from "@/lib/material-sourcing-risk.functions";
import { Markdown } from "@/components/markdown";

export function MaterialSourcingRiskPanel() {
  const fn = useServerFn(getMaterialSourcingRisks);
  const { data, isLoading } = useQuery({
    queryKey: ["material-sourcing-risks"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;
  if (data.rows.length === 0) return null;

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex items-center gap-2">
        <Package className="size-4 text-primary" />
        <div className="font-medium text-sm">Material → Sourcing</div>
        <span className="text-xs text-muted-foreground">
          — materiais com falha sistêmica no BOM
        </span>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span>{data.summary.materialsAtRisk} em risco</span>
          <span>{data.summary.totalOpenCapas} CAPAs abertas</span>
          <span>{data.summary.totalProducts} produtos</span>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown content={data.insight} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {data.rows.map((r) => (
          <div key={r.key} className="rounded-md border border-border p-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{r.displayName}</div>
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
              <span className="inline-flex items-center gap-1">
                <AlertOctagon className="size-3" /> {r.openCapaCount}/{r.capaCount} CAPAs
              </span>
              <span className="inline-flex items-center gap-1">
                <Factory className="size-3" /> {r.productsAffected} produtos
              </span>
              {r.activeCollections[0]?.daysToLaunch != null && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" /> {r.activeCollections[0].daysToLaunch}d
                </span>
              )}
            </div>
            <div className="text-muted-foreground/90 prose prose-xs dark:prose-invert max-w-none [&_p]:my-0">
              <Markdown content={r.recommendation} />
            </div>
            {r.suppliers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {r.suppliers.map((s) => (
                  <span
                    key={s.id}
                    className="text-[10px] border border-border rounded px-1.5 py-0.5"
                    title={`${s.capaCount} CAPAs${s.avgScore != null ? ` · score ${Math.round(s.avgScore)}` : ""}`}
                  >
                    {s.name ?? s.id.slice(0, 6)}
                    <span className="ml-1 text-destructive">×{s.capaCount}</span>
                    {s.avgScore != null && (
                      <span
                        className={`ml-1 ${s.avgScore < 60 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {Math.round(s.avgScore)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {r.activeCollections.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.activeCollections.map((c) => (
                  <Link
                    key={c.id}
                    to="/colecao-360/$id"
                    params={{ id: c.id }}
                    className="text-[10px] border border-border rounded px-1.5 py-0.5 hover:bg-muted"
                  >
                    {c.name}
                    {c.daysToLaunch != null && (
                      <span className="ml-1 text-muted-foreground">{c.daysToLaunch}d</span>
                    )}
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
