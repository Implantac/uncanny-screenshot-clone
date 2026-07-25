import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Minus, GitBranch, AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getMaterialCostCascade } from "@/lib/material-cost-cascade.functions";

const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Onda C — Cost Engine visível em cadeia
 * Mostra o impacto de mudanças de um material em todas as fichas/produtos.
 */
export function MaterialCostCascadePanel({ materialId }: { materialId: string }) {
  const fn = useServerFn(getMaterialCostCascade);
  const { data, isLoading } = useQuery({
    queryKey: ["material-cost-cascade", materialId],
    queryFn: () => fn({ data: { materialId } }),
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return <div className="h-24 rounded-lg border bg-muted/30 animate-pulse" />;
  }
  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4" />
          <span>Nenhuma ficha técnica ainda consome este material.</span>
        </div>
      </div>
    );
  }

  const avg = data.averageDeltaPct;
  const AvgIcon = avg == null || avg === 0 ? Minus : avg > 0 ? TrendingUp : TrendingDown;
  const avgTone = avg == null || avg === 0 ? "text-muted-foreground" : avg > 0 ? "text-destructive" : "text-emerald-500";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Impacto em cadeia</h3>
          <Badge variant="outline" className="text-[10px]">Onda C</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat label="Fichas" value={data.totalTechSheets.toString()} />
          <Stat label="Produtos" value={data.totalProducts.toString()} />
          <Stat label="Custo adicional" value={brl(data.totalCostAtRisk)} tone={data.totalCostAtRisk > 0 ? "danger" : "muted"} />
          <Stat
            label="Δ médio"
            value={avg == null ? "—" : `${avg > 0 ? "+" : ""}${avg.toFixed(1)}%`}
            icon={<AvgIcon className={`size-3 ${avgTone}`} />}
            tone={avg == null ? "muted" : avg > 0 ? "danger" : "success"}
          />
        </div>
      </div>

      <ol className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {data.rows.map((r) => {
          const up = (r.deltaPct ?? 0) > 0;
          const flat = (r.deltaPct ?? 0) === 0;
          const Trend = flat ? Minus : up ? TrendingUp : TrendingDown;
          const trendTone = flat ? "text-muted-foreground" : up ? "text-destructive" : "text-emerald-500";
          const overTarget = r.targetGapPct != null && r.targetGapPct > 5;
          return (
            <li key={r.techSheetId} className="px-4 py-3 hover:bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {r.productName ?? r.productSku ?? r.techSheetCode ?? r.techSheetId.slice(0, 8)}
                    </span>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {r.techSheetStatus}
                    </Badge>
                    {r.needsCostReview && (
                      <Badge variant="outline" className="text-[9px] gap-1 border-amber-500/40 text-amber-600 bg-amber-500/10">
                        <AlertTriangle className="size-2.5" />
                        revisar
                      </Badge>
                    )}
                    {overTarget && (
                      <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive bg-destructive/10">
                        +{r.targetGapPct!.toFixed(0)}% vs meta
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {r.techSheetCode ?? "—"} · {r.productSku ?? "sem SKU"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold font-mono">{brl(r.currentCost)}</div>
                  {r.deltaPct != null && (
                    <div className={`inline-flex items-center gap-1 text-[11px] font-mono ${trendTone}`}>
                      <Trend className="size-3" />
                      {up ? "+" : ""}
                      {r.deltaPct.toFixed(1)}% ({brl(r.deltaAbs)})
                    </div>
                  )}
                  {r.productId && (
                    <Link
                      to="/produto/$id"
                      params={{ id: r.productId }}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      abrir <ExternalLink className="size-2.5" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "muted" | "success" | "danger";
}) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-500" : "text-foreground";
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 flex items-center gap-1 ${toneCls}`}>
        {icon}
        {value}
      </div>
    </div>
  );
}
