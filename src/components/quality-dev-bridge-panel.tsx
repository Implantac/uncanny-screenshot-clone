import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Ruler, Repeat2, Lightbulb } from "lucide-react";
import { getDevBridgeAnalysis } from "@/lib/quality-dev-bridge.functions";

export function QualityDevBridgePanel() {
  const fetchDev = useServerFn(getDevBridgeAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["quality-dev-bridge"],
    queryFn: () => fetchDev(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5">
        <p className="text-sm text-muted-foreground">Cruzando Desenvolvimento × Qualidade…</p>
      </div>
    );
  }
  if (!data) return null;

  const ftrColor =
    data.firstTimeRight >= 70
      ? "text-emerald-500"
      : data.firstTimeRight >= 50
        ? "text-amber-500"
        : "text-red-500";

  const maxPom = data.topPoms[0]?.count ?? 1;

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Desenvolvimento × Qualidade</h2>
            <p className="text-xs text-muted-foreground">
              FTR, iterações e POMs problemáticos · {data.windowDays} dias
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${ftrColor}`}>
            {data.firstTimeRight.toFixed(0)}%
          </div>
          <div className="text-[11px] text-muted-foreground">First Time Right</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Card
          label="Protótipos"
          value={String(data.totalPrototypes)}
          sub={`${data.approvedPrototypes} aprovados`}
        />
        <Card
          label="FTR (sem ajuste)"
          value={`${data.ftrCount}/${data.approvedPrototypes}`}
          sub={`${data.withAdjustments} com ajustes`}
          highlight
        />
        <Card
          label="Iterações médias"
          value={data.avgIterations.toFixed(1)}
          sub={`${data.totalFitSessions} sessões fit`}
        />
        <Card
          label="Lead time médio"
          value={`${data.avgLeadTimeDays.toFixed(0)} d`}
          sub="briefing → aprovado"
        />
      </div>

      <div className="rounded-xl bg-muted/30 border border-border p-3 flex items-start gap-2 text-xs">
        <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-snug">{data.insight}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {data.topPoms.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Ruler className="size-3" /> POMs problemáticos
            </h3>
            <div className="space-y-1.5">
              {data.topPoms.map((p) => (
                <div key={p.pom} className="flex items-center gap-2 text-xs">
                  <span className="w-40 truncate capitalize" title={p.pom}>
                    {p.pom}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={`h-full ${p.criticalCount > 0 ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${(p.count / maxPom) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{p.count}</span>
                  {p.criticalCount > 0 && (
                    <span className="w-10 text-right tabular-nums text-red-500">
                      {p.criticalCount}!
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.recurrentReasons.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Repeat2 className="size-3" /> Ajustes recorrentes
            </h3>
            <div className="space-y-1.5">
              {data.recurrentReasons.map((r) => (
                <div
                  key={r.reason}
                  className="rounded-lg border border-border bg-muted/20 p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium" title={r.reason}>
                      {r.reason}
                    </span>
                    <span className="text-primary font-semibold shrink-0">{r.count}×</span>
                  </div>
                  {r.sectors.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.sectors.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
