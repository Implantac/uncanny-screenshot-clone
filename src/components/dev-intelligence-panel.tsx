import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Activity, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { getDevIntelligence, type DevIntelligence } from "@/lib/dev-intelligence.functions";

const STAGE_LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  em_confeccao: "Em confecção",
  em_prova: "Em prova",
};

const SEVERITY_TONE = {
  info: "bg-muted/40 text-muted-foreground border-border",
  warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/40",
} as const;

export function DevIntelligencePanel() {
  const fn = useServerFn(getDevIntelligence);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<DevIntelligence>({
    queryKey: ["dev-intelligence"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        Carregando inteligência de desenvolvimento…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">IA-Dev — Funil em tempo real</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Lead time médio"
          value={`${data.totalLeadTimeDays.toFixed(1)}d`}
          hint="solicitado → aprovado"
        />
        <Metric
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Taxa de aprovação"
          value={`${(data.approvalRate * 100).toFixed(0)}%`}
          hint="aprovados / finalizados"
        />
        <Metric
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Gargalo"
          value={data.bottleneck ? STAGE_LABEL[data.bottleneck] ?? data.bottleneck : "—"}
          hint="estágio mais lento"
        />
        <Metric
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Travados"
          value={String(data.stuck.length)}
          hint=">1.5× a média"
        />
      </div>

      {data.stageStats.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Tempo médio por estágio
          </div>
          {data.stageStats.map((s) => {
            const max = Math.max(...data.stageStats.map((x) => x.avgDays), 1);
            const pct = (s.avgDays / max) * 100;
            return (
              <div key={s.stage} className="flex items-center gap-2 text-xs">
                <span className="w-28 text-muted-foreground">
                  {STAGE_LABEL[s.stage] ?? s.stage}
                </span>
                <div className="flex-1 h-2 rounded bg-muted/30 overflow-hidden">
                  <div
                    className="h-full bg-primary/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums">
                  {s.avgDays.toFixed(1)}d
                </span>
                <span className="w-12 text-right text-muted-foreground tabular-nums">
                  n={s.count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {data.insights.length > 0 && (
        <div className="space-y-2">
          {data.insights.map((i, idx) => (
            <div
              key={idx}
              className={`rounded border px-3 py-2 text-xs ${SEVERITY_TONE[i.severity]}`}
            >
              <div className="font-medium">{i.title}</div>
              <div className="opacity-90">{i.message}</div>
            </div>
          ))}
        </div>
      )}

      {data.stuck.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Protótipos travados
          </div>
          <div className="space-y-1">
            {data.stuck.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  navigate({ to: "/prototipo/$id", params: { id: p.id } })
                }
                className="w-full flex items-center justify-between gap-2 text-left text-xs rounded border border-border/60 px-2 py-1.5 hover:bg-accent/40 transition"
              >
                <span className="font-medium truncate">
                  {p.code}
                  {p.name ? <span className="text-muted-foreground"> · {p.name}</span> : null}
                </span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {p.daysInStage}d em {STAGE_LABEL[p.stage] ?? p.stage}{" "}
                  <span className="opacity-70">(média {p.avgForStage}d)</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-border/60 bg-background/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
