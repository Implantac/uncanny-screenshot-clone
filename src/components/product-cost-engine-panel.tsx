import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, TrendingDown, Sparkles, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getProductCostHistory,
  getSuggestedRetailPrice,
  type CostHistoryPoint,
} from "@/lib/product-cost-engine.functions";

const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function MiniSpark({ points }: { points: CostHistoryPoint[] }) {
  const data = useMemo(() => [...points].reverse(), [points]);
  if (data.length < 2) return null;
  const w = 220;
  const h = 48;
  const min = Math.min(...data.map((d) => d.totalCost));
  const max = Math.max(...data.map((d) => d.totalCost));
  const span = max - min || 1;
  const path = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d.totalCost - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = data[data.length - 1]!.totalCost;
  const first = data[0]!.totalCost;
  const up = last >= first;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" strokeWidth={2} className={up ? "stroke-destructive" : "stroke-success"} />
    </svg>
  );
}

/**
 * Onda 19 — Cost Engine Reativo
 * Mostra evolução histórica do custo + preço sugerido reativo.
 */
export function ProductCostEnginePanel({ productId }: { productId: string }) {
  const callHistory = useServerFn(getProductCostHistory);
  const callSuggest = useServerFn(getSuggestedRetailPrice);

  const history = useQuery({
    queryKey: ["product-cost-history", productId],
    queryFn: () => callHistory({ data: { productId, limit: 30 } }),
  });
  const suggest = useQuery({
    queryKey: ["product-cost-suggest", productId],
    queryFn: () => callSuggest({ data: { productId } }),
  });

  const pts = history.data ?? [];
  const latest = pts[0];
  const previous = pts[1];
  const delta =
    latest && previous ? latest.totalCost - previous.totalCost : 0;
  const deltaPct =
    latest && previous && previous.totalCost > 0
      ? (delta / previous.totalCost) * 100
      : 0;

  const s = suggest.data;
  const gap = s?.gapPct ?? null;
  const gapTone =
    gap == null
      ? "bg-muted text-muted-foreground"
      : Math.abs(gap) < 5
        ? "bg-success/15 text-success border-success/30"
        : gap > 0
          ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
          : "bg-destructive/15 text-destructive border-destructive/30";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cost Engine reativo</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">Onda 19</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Custo atual
          </div>
          <div className="text-xl font-semibold mt-1">{brl(s?.currentCost ?? latest?.totalCost ?? null)}</div>
          {latest && previous && (
            <div
              className={`flex items-center gap-1 text-xs mt-1 ${
                delta > 0 ? "text-destructive" : delta < 0 ? "text-success" : "text-muted-foreground"
              }`}
            >
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta === 0 ? "sem mudança" : `${delta > 0 ? "+" : ""}${brl(delta)} (${deltaPct.toFixed(1)}%)`}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Preço sugerido
          </div>
          <div className="text-xl font-semibold mt-1">{brl(s?.suggestedPrice ?? null)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {s?.targetMarginPct != null
              ? `margem meta ${s.targetMarginPct.toFixed(0)}%`
              : "sem margem meta"}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Preço praticado
          </div>
          <div className="text-xl font-semibold mt-1">{brl(s?.currentRetail ?? null)}</div>
          <div className="mt-1">
            {gap != null ? (
              <Badge variant="outline" className={`text-[10px] ${gapTone}`}>
                {gap > 0 ? `+${gap.toFixed(1)}%` : `${gap.toFixed(1)}%`} vs sugerido
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">sem meta</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Evolução do custo</span>
          <span className="text-[11px] text-muted-foreground">
            {pts.length} snapshot(s)
          </span>
        </div>
        {history.isLoading ? (
          <div className="h-12 bg-muted/40 rounded animate-pulse" />
        ) : pts.length < 2 ? (
          <div className="text-xs text-muted-foreground">
            Ainda não há histórico suficiente. Cada mudança na ficha cria um snapshot automático.
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <MiniSpark points={pts} />
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <div>
                Primeiro: <span className="font-medium">{brl(pts[pts.length - 1]!.totalCost)}</span>
              </div>
              <div>
                Atual: <span className="font-medium">{brl(pts[0]!.totalCost)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
