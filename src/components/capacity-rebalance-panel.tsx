import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Layers, Loader2, Package, Sparkles, Truck } from "lucide-react";
import { getCapacityRebalanceSuggestions } from "@/lib/capacity-rebalance.functions";
import { applyRebalanceSuggestion } from "@/lib/pcp-intelligence.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function occTone(pct: number | null | undefined) {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 100) return "text-rose-400";
  if (pct >= 75) return "text-amber-400";
  return "text-emerald-400";
}

export function CapacityRebalancePanel() {
  const fn = useServerFn(getCapacityRebalanceSuggestions);
  const applyFn = useServerFn(applyRebalanceSuggestion);
  const qc = useQueryClient();
  const [applying, setApplying] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["capacity-rebalance"],
    queryFn: () => fn({ data: { limit: 8 } }),
    refetchInterval: 120_000,
  });

  const apply = useMutation({
    mutationFn: async (input: {
      orderId: string;
      toSupplierId: string;
      fromSupplier?: string;
      toSupplier?: string;
    }) => applyFn({ data: input }),
    onSuccess: (res) => {
      toast.success(`OP ${res?.code ?? ""} realocada`);
      qc.invalidateQueries({ queryKey: ["capacity-rebalance"] });
      qc.invalidateQueries({ queryKey: ["adaptive-production-priority"] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao realocar"),
    onSettled: () => setApplying(null),
  });

  const items = data?.suggestions ?? [];
  const totalHidden = useMemo(
    () => Math.max(0, (data?.total ?? 0) - items.length),
    [data?.total, items.length],
  );

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Auto-rebalanceamento de capacidade
          </h2>
          <p className="text-xs text-muted-foreground">
            OPs terceirizadas em risco alto — sugestões de transferência para fornecedores da
            mesma categoria com melhor scorecard e folga de capacidade.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="size-3" /> IA
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Sem gargalos críticos em estágios terceirizados — capacidade equilibrada.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const top = s.alternatives[0];
            const key = s.op_id;
            return (
              <li
                key={key}
                className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to="/lote/$id"
                        params={{ id: s.op_id }}
                        className="font-mono text-xs font-medium hover:underline"
                      >
                        {s.code}
                      </Link>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {s.stage.replaceAll("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {s.category}
                      </Badge>
                    </div>
                    {s.product_name && (
                      <div className="mt-0.5 font-medium truncate flex items-center gap-1">
                        <Package className="size-3 text-muted-foreground" />
                        {s.product_name}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Truck className="size-3" />
                        {s.current_supplier_name ?? "Sem fornecedor"}
                        {s.current_score != null && (
                          <span className="ml-1">
                            · score {Math.round(s.current_score)}
                          </span>
                        )}
                      </span>
                      <span className={occTone(s.current_occupancy_pct)}>
                        {s.current_occupancy_pct != null
                          ? `${s.current_occupancy_pct}% ocupação`
                          : "capacidade não declarada"}
                      </span>
                      <span>·</span>
                      <span>{s.quantity_remaining} pçs restantes</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-semibold text-rose-400">
                      {s.risk_score}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      risco
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground italic">{s.reason}</p>

                <div className="mt-3 space-y-1.5">
                  {s.alternatives.map((a) => (
                    <div
                      key={a.supplier_id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 text-xs">
                        <ArrowRight className="size-3 text-primary" />
                        <span className="font-medium truncate">{a.supplier_name}</span>
                        {a.score != null && (
                          <span className="text-muted-foreground">
                            score {Math.round(a.score)}
                          </span>
                        )}
                        <span className={occTone(a.occupancy_pct)}>
                          {a.occupancy_pct != null
                            ? `${a.occupancy_pct}% ocup.`
                            : "sem dados"}
                        </span>
                        <span className="text-muted-foreground">
                          · {a.pieces_per_day} pçs/dia
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={a === top ? "default" : "outline"}
                        disabled={apply.isPending && applying === `${key}:${a.supplier_id}`}
                        onClick={() => {
                          setApplying(`${key}:${a.supplier_id}`);
                          apply.mutate({
                            orderId: s.op_id,
                            toSupplierId: a.supplier_id,
                            fromSupplier: s.current_supplier_name ?? undefined,
                            toSupplier: a.supplier_name,
                          });
                        }}
                      >
                        {apply.isPending && applying === `${key}:${a.supplier_id}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Realocar"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalHidden > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          +{totalHidden} sugestão(ões) adicional(is) ocultas — ajuste filtros para ver mais.
        </p>
      )}
    </section>
  );
}
