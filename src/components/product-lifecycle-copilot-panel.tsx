import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProductLifecycleCopilot } from "@/lib/product-lifecycle-copilot.functions";

const priorityTone: Record<string, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/30",
  media: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  baixa: "bg-muted text-muted-foreground",
};

/** Onda 20 — Copiloto contextual do ciclo do produto */
export function ProductLifecycleCopilotPanel({ productId }: { productId: string }) {
  const call = useServerFn(getProductLifecycleCopilot);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["product-lifecycle-copilot", productId],
    queryFn: () => call({ data: { productId } }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Copiloto do ciclo</h3>
          <Badge variant="outline" className="text-[10px]">Onda 20</Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="h-20 bg-muted/40 rounded animate-pulse" />
      ) : error ? (
        <div className="text-xs text-destructive">Falha: {(error as Error).message}</div>
      ) : data ? (
        <>
          <div className="text-sm text-foreground/90">{data.summary}</div>

          {data.blockers.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 mb-1">
                <AlertTriangle className="h-3 w-3" />
                Gates pendentes
              </div>
              <ul className="space-y-0.5">
                {data.blockers.slice(0, 5).map((b, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {b}</li>
                ))}
              </ul>
            </div>
          )}

          {data.suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Próximas ações sugeridas
              </div>
              {data.suggestions.map((s, i) => (
                <div key={i} className="rounded-lg border bg-card p-3 flex items-start gap-3">
                  <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium">{s.title}</div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${priorityTone[s.priority] ?? ""}`}
                      >
                        {s.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.suggestions.length === 0 && data.blockers.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Sem sugestões pendentes no momento.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
