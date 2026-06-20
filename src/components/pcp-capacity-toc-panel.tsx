import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Lightbulb, AlertTriangle, Activity } from "lucide-react";
import { getCapacityTocReport } from "@/lib/pcp-capacity-toc.functions";

export function PcpCapacityTocPanel() {
  const fn = useServerFn(getCapacityTocReport);
  const { data, isLoading } = useQuery({
    queryKey: ["pcp-capacity-toc"],
    queryFn: () => fn(),
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="h-4 w-44 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }
  if (!data) return null;

  const { stages, summary, insight } = data;

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Gauge className="size-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">Capacidade × Demanda (TOC)</h2>
          <p className="text-xs text-muted-foreground">
            Throughput observado nos últimos 14d vs demanda das próximas 4 semanas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Etapas ativas" value={String(summary.activeStages)} />
        <Kpi
          label="Gargalos"
          value={String(summary.bottlenecks)}
          tone={summary.bottlenecks ? "danger" : "ok"}
        />
        <Kpi label="WIP (peças)" value={summary.totalWipPieces.toLocaleString("pt-BR")} />
        <Kpi
          label="Saúde do pipeline"
          value={`${summary.pipelineHealthPct.toFixed(0)}%`}
          tone={summary.pipelineHealthPct >= 80 ? "ok" : summary.pipelineHealthPct >= 50 ? "neutral" : "danger"}
        />
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex gap-2 items-start">
        <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-snug">{insight}</p>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-2">Etapa</th>
              <th className="text-right px-2 py-2">WIP</th>
              <th className="text-right px-2 py-2">Throughput</th>
              <th className="text-right px-2 py-2">Demanda 4s</th>
              <th className="text-right px-2 py-2">Utilização</th>
              <th className="text-right px-2 py-2">Cobertura</th>
              <th className="text-left px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.key} className="border-t border-border/50">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: s.color ?? "var(--muted-foreground)" }}
                    />
                    <span className="font-medium">{s.label}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.wipPieces}
                  <span className="text-[11px] text-muted-foreground"> / {s.wipOrders} OPs</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.throughputPerDay}
                  <span className="text-[11px] text-muted-foreground"> pç/d</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{s.demandNext4w}</td>
                <td className="px-2 py-2 text-right">
                  <UtilBar pct={s.utilizationPct} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                  {s.coverageDays > 100 ? "—" : `${s.coverageDays}d`}
                </td>
                <td className="px-2 py-2">
                  <StatusPill status={s.status} reason={s.reason} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "danger";
}) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "ok" ? "text-emerald-500" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums mt-0.5 ${toneCls}`}>{value}</div>
    </div>
  );
}

function UtilBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 120);
  const color =
    pct >= 100 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(capped, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums w-9 text-right">{pct}%</span>
    </div>
  );
}

function StatusPill({
  status,
  reason,
}: {
  status: "ok" | "alerta" | "gargalo";
  reason: string;
}) {
  const cls =
    status === "gargalo"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : status === "alerta"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  const Icon = status === "gargalo" ? AlertTriangle : status === "alerta" ? Activity : Lightbulb;
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}
      >
        <Icon className="size-3" />
        {status === "gargalo" ? "Gargalo" : status === "alerta" ? "Alerta" : "OK"}
      </span>
      <div className="text-[11px] text-muted-foreground leading-tight max-w-[260px]">{reason}</div>
    </div>
  );
}
