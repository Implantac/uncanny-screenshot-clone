import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Factory,
  AlertTriangle,
  Clock,
  Package,
  CheckCircle2,
  TrendingDown,
  Loader2,
  Target,
} from "lucide-react";
import { getProductPcpHealth } from "@/lib/product-pcp-health.functions";
import { Badge } from "@/components/ui/badge";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

export function ProductPcpHealthPanel({ productId }: { productId: string }) {
  const fn = useServerFn(getProductPcpHealth);
  const { data, isLoading, error } = useQuery({
    queryKey: ["product-pcp-health", productId],
    queryFn: () => fn({ data: { productId } }),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Calculando saúde produtiva…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Falha ao carregar PCP do produto: {(error as Error)?.message ?? "sem dados"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Factory} label="OPs abertas" value={String(data.open_orders)}
             hint={`${data.open_qty} pç em andamento`} />
        <Kpi
          icon={AlertTriangle}
          label="OPs atrasadas"
          value={String(data.late_orders)}
          tone={data.late_orders > 0 ? "danger" : "default"}
        />
        <Kpi
          icon={CheckCircle2}
          label="On-time"
          value={data.on_time_pct != null ? `${data.on_time_pct}%` : "—"}
          tone={
            data.on_time_pct == null
              ? "default"
              : data.on_time_pct >= 90
                ? "success"
                : data.on_time_pct >= 75
                  ? "warning"
                  : "danger"
          }
          hint="baseado em OPs concluídas"
        />
        <Kpi
          icon={Package}
          label="Cobertura de material"
          value={
            data.reservations.coverage_pct != null
              ? `${data.reservations.coverage_pct}%`
              : "—"
          }
          tone={
            data.reservations.shortage_items > 0
              ? "warning"
              : data.reservations.coverage_pct != null
                ? "success"
                : "default"
          }
          hint={
            data.reservations.shortage_items > 0
              ? `${data.reservations.shortage_items} item(ns) com falta`
              : `${data.reservations.active} reserva(s) ativa(s)`
          }
        />
      </div>

      {/* Foco + Gargalo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-1">
            <Target className="size-4 text-primary" /> Foco recomendado
          </div>
          <p className="text-sm text-foreground">{data.focus}</p>
          {data.recent_occurrences > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {data.recent_occurrences} ocorrência(s) registrada(s) nos últimos 30 dias.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-1">
            <TrendingDown className="size-4 text-amber-500" /> Gargalo atual
          </div>
          {data.bottleneck ? (
            <>
              <div className="text-base font-semibold">{data.bottleneck.stage_label}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.bottleneck.reason}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum gargalo identificado — WIP distribuído.
            </p>
          )}
        </div>
      </div>

      {/* WIP por etapa vs SLA */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">WIP por setor × SLA</div>
          <span className="text-[11px] text-muted-foreground">
            dwell = dias parados na etapa atual
          </span>
        </div>
        {data.stages.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Sem WIP ativo e sem roteiro de produção configurado para este produto.
          </div>
        ) : (
          <div className="space-y-2">
            {data.stages.map((s) => (
              <div
                key={s.stage_key}
                className="flex items-center gap-3 border border-border/60 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.stage_label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.wip_orders} OP · {s.wip_qty} pç
                    {s.avg_dwell_days != null && (
                      <>
                        {" · "}
                        <Clock className="inline size-3 -mt-0.5" /> {s.avg_dwell_days}d
                        {s.sla_days != null && ` / SLA ${s.sla_days}d`}
                      </>
                    )}
                  </div>
                </div>
                {s.breach ? (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                    SLA estourado
                  </Badge>
                ) : s.sla_days != null && s.avg_dwell_days != null ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                    dentro do SLA
                  </Badge>
                ) : s.wip_orders > 0 ? (
                  <Badge variant="outline">ativo</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    sem WIP
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IA de PCP focada no produto */}
      <AICoordinatorPanel
        persona="pcp"
        title="PCP · Recomendações para este produto"
        question={`Considere o produto ${productId}. Foco atual: ${data.focus}. Gargalo: ${
          data.bottleneck ? data.bottleneck.stage_label + " — " + data.bottleneck.reason : "nenhum"
        }. Aponte 3 ações concretas para reduzir risco de atraso.`}
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${cls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
