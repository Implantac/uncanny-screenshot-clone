import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Target } from "lucide-react";
import { getParetoAnalysis, type Cause5M } from "@/lib/quality-pareto.functions";

const CAUSE_COLOR: Record<Cause5M, string> = {
  metodo: "bg-blue-500",
  mao_de_obra: "bg-purple-500",
  material: "bg-amber-500",
  maquina: "bg-rose-500",
  meio: "bg-emerald-500",
};

export function QualityParetoPanel() {
  const fetchPareto = useServerFn(getParetoAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["quality-pareto"],
    queryFn: () => fetchPareto(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5">
        <p className="text-sm text-muted-foreground">Analisando causas…</p>
      </div>
    );
  }
  if (!data) return null;

  const max = data.pareto[0]?.count ?? 1;

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <BarChart3 className="size-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Pareto & 5M — Análise de Causas</h2>
          <p className="text-xs text-muted-foreground">
            {data.total} ocorrências/reprovações nos últimos {data.windowDays} dias
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-muted/30 border border-border p-3 flex items-start gap-2 text-xs">
        <Target className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-snug">{data.insight}</p>
      </div>

      {/* 5M */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Distribuição 5M
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {data.fiveM.map((b) => (
            <div
              key={b.cause}
              className="rounded-xl border border-border bg-muted/20 p-3 space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${CAUSE_COLOR[b.cause]}`} />
                <span className="text-xs font-medium">{b.label}</span>
              </div>
              <div className="text-lg font-bold">{b.pct.toFixed(0)}%</div>
              <div className="text-[10px] text-muted-foreground truncate" title={b.topExample}>
                {b.count} · {b.topExample}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pareto */}
      {data.pareto.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Pareto · vital few (80%) destacado
          </h3>
          <div className="space-y-1.5">
            {data.pareto.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-xs">
                <span
                  className={`size-2 rounded-full shrink-0 ${CAUSE_COLOR[p.cause]}`}
                  title={p.cause}
                />
                <span className="w-48 truncate" title={p.label}>
                  {p.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full ${p.isVitalFew ? "bg-primary" : "bg-muted-foreground/40"}`}
                    style={{ width: `${(p.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums">{p.count}</span>
                <span
                  className={`w-12 text-right tabular-nums ${
                    p.isVitalFew ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {p.cumulativePct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
