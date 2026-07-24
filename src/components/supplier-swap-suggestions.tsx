import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { getSupplierSwapSuggestions } from "@/lib/supplier-priority.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function scoreTone(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

export function SupplierSwapSuggestionsPanel({
  onSelectSupplier,
}: {
  onSelectSupplier?: (supplierId: string) => void;
}) {
  const fn = useServerFn(getSupplierSwapSuggestions);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-swap-suggestions"],
    queryFn: () => fn({ data: { critical_threshold: 45, limit: 8, alternatives: 3 } }),
    refetchInterval: 90_000,
  });

  const rows = data?.suggestions ?? [];

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="size-4 text-rose-400" />
            Priorização adaptativa — trocar fornecedor em zona crítica
          </h2>
          <p className="text-xs text-muted-foreground">
            POs abertas com fornecedor abaixo de {data?.threshold ?? 45} pts no scorecard e
            alternativas melhores na mesma categoria.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <TrendingUp className="size-3" /> adaptativo
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Nenhuma PO aberta com fornecedor em zona crítica. Continue assim.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => (
            <li
              key={s.po_id}
              className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{s.po_code}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.po_status}
                    </Badge>
                    {s.supplier_category && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {s.supplier_category}
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-left font-medium hover:underline"
                    onClick={() => onSelectSupplier?.(s.supplier_id)}
                  >
                    {s.supplier_name}
                  </button>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-semibold ${scoreTone(s.current_score)}`}>
                    {s.current_score.toFixed(0)}
                  </div>
                  {s.current_delta != null && (
                    <div className="flex items-center justify-end gap-1 text-[11px] text-rose-400">
                      <TrendingDown className="size-3" />
                      {s.current_delta}
                    </div>
                  )}
                </div>
              </div>

              {s.alternatives.length > 0 ? (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <ArrowRight className="size-3" /> Sugerir substituição por
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {s.alternatives.map((a) => (
                      <li
                        key={a.supplier_id}
                        className="rounded-md border border-border/50 bg-background/40 px-2 py-1.5 flex items-center justify-between gap-2 hover:bg-muted/30 transition cursor-pointer"
                        onClick={() => onSelectSupplier?.(a.supplier_id)}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{a.supplier_name}</div>
                          {a.category && (
                            <div className="text-[10px] text-muted-foreground capitalize truncate">
                              {a.category}
                            </div>
                          )}
                        </div>
                        <div className={`text-sm font-semibold ${scoreTone(a.score)}`}>
                          {a.score.toFixed(0)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Sem alternativa qualificada na mesma categoria — considere abrir RFQ.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
