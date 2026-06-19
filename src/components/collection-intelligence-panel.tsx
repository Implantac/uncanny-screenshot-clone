import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { getCollectionIntelligence } from "@/lib/collection-intelligence.functions";
import { Markdown } from "@/components/markdown";

const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

export function CollectionIntelligencePanel() {
  const fn = useServerFn(getCollectionIntelligence);
  const { data, isLoading } = useQuery({
    queryKey: ["collection-intelligence"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (!data) return null;

  return (
    <section className="glass rounded-xl p-4 space-y-4">
      <header className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <div className="font-medium text-sm">Coleção Inteligente</div>
        <span className="text-xs text-muted-foreground">
          — produtos âncora, risco por coleção e sugestões
        </span>
      </header>

      {data.suggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
          {data.suggestions.map((s, i) => (
            <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown content={s} />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <TrendingUp className="size-3.5" /> Produtos âncora (90d)
          </div>
          {data.anchorProducts.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sem vendas no período.</div>
          ) : (
            <div className="space-y-1">
              {data.anchorProducts.slice(0, 5).map((p) => (
                <div
                  key={p.sku}
                  className="flex items-center justify-between text-xs border-b border-border/50 pb-1"
                >
                  <div className="font-mono">{p.sku}</div>
                  <div className="text-muted-foreground">
                    {p.units} un · {fmt(p.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle className="size-3.5" /> Coleções em risco
          </div>
          {data.risks.length === 0 ? (
            <div className="text-xs text-muted-foreground">Tudo no ritmo.</div>
          ) : (
            <div className="space-y-1.5">
              {data.risks.slice(0, 5).map((r) => (
                <div key={r.id} className="text-xs rounded-md border border-border p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.name}</div>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        r.risk === "high"
                          ? "bg-destructive/15 text-destructive"
                          : r.risk === "medium"
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-emerald-500/15 text-emerald-600"
                      }`}
                    >
                      {r.risk}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-2">
                    {r.daysToLaunch !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {r.daysToLaunch}d
                      </span>
                    )}
                    <span>
                      {r.approvedSheetsPct}% fichas · {r.activeOps} OPs
                    </span>
                  </div>
                  <div className="text-muted-foreground/80 mt-0.5">{r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
