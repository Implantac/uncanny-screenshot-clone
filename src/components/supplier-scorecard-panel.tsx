import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingDown, TrendingUp, ShieldAlert, Sparkles } from "lucide-react";
import {
  getSupplierScorecardMovers,
  getSupplierScorecard,
} from "@/lib/supplier-scorecard.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function scoreTone(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

function deltaTone(delta: number | null) {
  if (delta == null) return "text-muted-foreground";
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-rose-400";
  return "text-muted-foreground";
}

export function SupplierScorecardMoversPanel({
  onSelect,
}: {
  onSelect?: (supplierId: string) => void;
}) {
  const fn = useServerFn(getSupplierScorecardMovers);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-scorecard-movers", "down"],
    queryFn: () => fn({ data: { direction: "down", limit: 6 } }),
    refetchInterval: 60_000,
  });

  const rows = data ?? [];
  const hasData = rows.length > 0;

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            Scorecard adaptativo — quedas recentes
          </h2>
          <p className="text-xs text-muted-foreground">
            Score composto por OTIF, FPY, ocorrências e CAPAs reabertas (janela padrão 90d).
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="size-3" /> auto
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : !hasData ? (
        <div className="text-xs text-muted-foreground">
          Nenhum snapshot ainda. O recálculo diário publica os primeiros scores automaticamente.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
          {rows.map((r) => {
            const delta = r.delta ?? 0;
            const Trend = delta < 0 ? TrendingDown : TrendingUp;
            return (
              <li
                key={r.supplier_id}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/40 transition ${
                  onSelect ? "cursor-pointer" : ""
                }`}
                onClick={() => onSelect?.(r.supplier_id)}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.supplier_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.notes ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`text-lg font-semibold ${scoreTone(r.score)}`}>
                    {r.score.toFixed(0)}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${deltaTone(r.delta)}`}>
                    <Trend className="size-3" />
                    {r.delta != null ? `${r.delta > 0 ? "+" : ""}${r.delta}` : "—"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function SupplierScorecardMini({ supplierId }: { supplierId: string }) {
  const fn = useServerFn(getSupplierScorecard);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-scorecard", supplierId],
    queryFn: () => fn({ data: { supplier_id: supplierId, limit: 12 } }),
    enabled: Boolean(supplierId),
  });

  const latest = data?.latest ?? null;
  const history = data?.history ?? [];

  const spark = useMemo(() => {
    if (history.length < 2) return null;
    const scores = history.map((h) => h.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const w = 120;
    const h = 28;
    const step = w / (scores.length - 1);
    const points = scores
      .map((s, i) => `${(i * step).toFixed(1)},${(h - ((s - min) / range) * h).toFixed(1)}`)
      .join(" ");
    return { points, w, h };
  }, [history]);

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!latest) {
    return (
      <div className="text-xs text-muted-foreground">
        Sem snapshot de scorecard ainda para este fornecedor.
      </div>
    );
  }

  const score = Number(latest.score ?? 0);
  const delta = latest.delta != null ? Number(latest.delta) : null;
  const Trend = (delta ?? 0) < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Scorecard
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${scoreTone(score)}`}>
              {score.toFixed(0)}
            </span>
            <span className={`text-xs flex items-center gap-1 ${deltaTone(delta)}`}>
              <Trend className="size-3" />
              {delta != null ? `${delta > 0 ? "+" : ""}${delta}` : "—"}
            </span>
          </div>
        </div>
        {spark && (
          <svg width={spark.w} height={spark.h} className="text-primary">
            <polyline
              points={spark.points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{latest.notes ?? "—"}</div>
    </div>
  );
}
