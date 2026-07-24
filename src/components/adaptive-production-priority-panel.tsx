import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Flame, Gauge, Package, Truck } from "lucide-react";
import { getAdaptiveProductionPriority } from "@/lib/production-priority.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function riskTone(r: number) {
  if (r >= 70) return "text-rose-400";
  if (r >= 45) return "text-amber-400";
  return "text-emerald-400";
}

export function AdaptiveProductionPriorityPanel() {
  const fn = useServerFn(getAdaptiveProductionPriority);
  const { data, isLoading } = useQuery({
    queryKey: ["adaptive-production-priority"],
    queryFn: () => fn({ data: { limit: 12, sla_hours: 48 } }),
    refetchInterval: 90_000,
  });
  const rows = data?.items ?? [];

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Flame className="size-4 text-rose-400" />
            Priorização adaptativa da fila do PCP
          </h2>
          <p className="text-xs text-muted-foreground">
            Risco composto: prazo, prioridade, tempo parado, scorecard do fornecedor e cobertura de
            materiais.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Gauge className="size-3" /> adaptativo
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Sem OPs ativas para reordenar. Fluxo saudável.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((it, idx) => (
            <li
              key={it.op_id}
              className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <Link
                      to="/lote/$id"
                      params={{ id: it.op_id }}
                      className="font-mono text-xs font-medium hover:underline"
                    >
                      {it.code}
                    </Link>
                    {it.stage && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {it.stage.replaceAll("_", " ")}
                      </Badge>
                    )}
                    {it.status === "atrasada" && (
                      <Badge variant="destructive" className="text-[10px]">
                        atrasada
                      </Badge>
                    )}
                  </div>
                  {it.product_name && (
                    <div className="mt-0.5 font-medium truncate flex items-center gap-1">
                      <Package className="size-3 text-muted-foreground" />
                      {it.product_name}
                      {it.product_sku && (
                        <span className="text-[11px] text-muted-foreground">
                          · {it.product_sku}
                        </span>
                      )}
                    </div>
                  )}
                  {it.supplier_name && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Truck className="size-3" />
                      {it.supplier_name}
                      {it.supplier_score != null && (
                        <span className="ml-1">· scorecard {Math.round(it.supplier_score)}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-2xl font-semibold ${riskTone(it.risk)}`}>{it.risk}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    risco
                  </div>
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {it.reasons.map((r, i) => (
                  <li
                    key={i}
                    className="text-[11px] rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-muted-foreground"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
