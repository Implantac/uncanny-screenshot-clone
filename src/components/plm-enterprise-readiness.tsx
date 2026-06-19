import { useQuery } from "@tanstack/react-query";
import type React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  PackageSearch,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Workflow,
} from "lucide-react";
import {
  loadPlmEnterpriseReadiness,
  type PlmStageReadiness,
  type PlmStageStatus,
} from "@/lib/plm-maturity";

const statusLabel: Record<PlmStageStatus, string> = {
  completa: "Completa",
  parcial: "Parcial",
  ausente: "Ausente",
};

const statusClass: Record<PlmStageStatus, string> = {
  completa: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  parcial: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  ausente: "border-rose-500/30 bg-rose-500/10 text-rose-600",
};

const iconByStage: Record<string, React.ComponentType<{ className?: string }>> = {
  development: Sparkles,
  collections: Layers,
  "tech-sheet": FileText,
  production: Workflow,
  quality: ShieldCheck,
  supply: PackageSearch,
  "commercial-loop": TrendingUp,
};

export function PlmEnterpriseReadiness() {
  const { data, isLoading } = useQuery({
    queryKey: ["plm-enterprise-readiness"],
    queryFn: loadPlmEnterpriseReadiness,
  });

  if (isLoading || !data) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="h-40 grid place-items-center text-sm text-muted-foreground">
          Calculando maturidade PLM…
        </div>
      </section>
    );
  }

  const topGaps = data.stages
    .flatMap((stage) => stage.gaps.map((gap) => ({ gap, stage: stage.title, score: stage.score })))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Radar className="size-4 text-primary" />
              Readiness enterprise
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Ciclo produto → coleção → lote → produção → venda
              </h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Camada de auditoria viva sobre módulos existentes. Mede cobertura real do PLM sem
                duplicar telas nem trazer responsabilidades fiscais/financeiras do ERP.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right">
              <div className="text-4xl font-semibold tabular-nums">{data.score}</div>
              <div className="text-xs text-muted-foreground">score geral</div>
            </div>
            <span
              className={`mb-1 rounded-md border px-2.5 py-1 text-xs font-medium ${statusClass[data.status]}`}
            >
              {statusLabel[data.status]}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <CoverageCard label="Completas" value={data.coverage.complete} tone="good" />
          <CoverageCard label="Parciais" value={data.coverage.partial} tone="warn" />
          <CoverageCard label="Ausentes" value={data.coverage.absent} tone="bad" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.stages.map((stage) => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </div>

        <aside className="rounded-xl border border-border bg-card p-5 h-fit">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 text-amber-500" />
            Lacunas prioritárias
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Próximas evoluções incrementais, sem recriar módulos existentes.
          </div>
          <div className="mt-4 space-y-3">
            {topGaps.length === 0 ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600">
                Nenhuma lacuna crítica detectada com os dados atuais.
              </div>
            ) : (
              topGaps.map((item) => (
                <div
                  key={`${item.stage}-${item.gap}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="text-xs font-medium text-muted-foreground">{item.stage}</div>
                  <div className="mt-1 text-sm">{item.gap}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function CoverageCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "bad";
}) {
  const tones = {
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-rose-600",
  };
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className={`text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StageCard({ stage }: { stage: PlmStageReadiness }) {
  const Icon = iconByStage[stage.id] ?? CheckCircle2;
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-muted grid place-items-center text-primary">
            <Icon className="size-4" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{stage.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{stage.subtitle}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass[stage.status]}`}
        >
          {statusLabel[stage.status]}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Maturidade</span>
          <span className="font-medium tabular-nums">{stage.score}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${stage.score}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {stage.metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[11px] text-muted-foreground">{metric.label}</div>
            <div className="text-sm font-semibold tabular-nums">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {stage.nextActions.slice(0, 2).map((action) => (
          <div key={action} className="flex gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" />
            <span>{action}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
