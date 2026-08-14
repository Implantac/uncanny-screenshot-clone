import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getDevelopmentFlowStats, type DevFlowStepStat } from "@/lib/development-flow.functions";
import { STEP_META, type WorkflowStep } from "@/lib/product-workflow.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  PenTool,
  FileText,
  DollarSign,
  Scissors,
  ShoppingBag,
  Crown,
  ShieldCheck,
  Factory,
  Users,
  ArrowRight,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  Sparkles,
  PenTool,
  FileText,
  DollarSign,
  Scissors,
  ShoppingBag,
  Crown,
  ShieldCheck,
  Factory,
} as const;

function StepIcon({ name, className }: { name: string; className?: string }) {
  const Comp =
    (ICONS as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Circle;
  return <Comp className={className} />;
}

/**
 * Mapeamento das etapas do sistema para o fluxograma do usuário
 * (1ª/2ª/3ª Reunião + gates de aprovação).
 */
type FlowNode =
  | { kind: "start"; id: string; label: string }
  | { kind: "process"; id: string; step: WorkflowStep; sub?: string; who?: string }
  | { kind: "meeting"; id: string; label: string; who: string; sub?: string; step?: WorkflowStep }
  | { kind: "decision"; id: string; label: string; yes: string; no: string; adjust?: string }
  | { kind: "end"; id: string; label: string; tone: "ok" | "reject" };

const FLOW: FlowNode[] = [
  { kind: "start", id: "start", label: "Início" },
  {
    kind: "process",
    id: "concepcao",
    step: "concepcao",
    sub: "Desenho, moodboard e proposta inicial",
  },
  {
    kind: "meeting",
    id: "reuniao1",
    label: "1ª Reunião — Avaliação da proposta",
    who: "Desenvolvimento + Marketing + Gerência",
  },
  {
    kind: "decision",
    id: "gate1",
    label: "Produto aprovado?",
    yes: "Segue para ficha técnica",
    no: "FIM · Reprovado",
  },
  {
    kind: "process",
    id: "engenharia",
    step: "engenharia",
    sub: "Matéria-prima, aviamentos, costuras, bordados, silk, medidas, processos, custos",
  },
  { kind: "process", id: "modelagem", step: "modelagem", sub: "Modelagem e corte do piloto" },
  {
    kind: "process",
    id: "piloto",
    step: "piloto",
    sub: "Desenvolver piloto conforme ficha (interno ou terceirizado)",
  },
  {
    kind: "meeting",
    id: "reuniao2",
    label: "2ª Reunião — Avaliação estética do piloto",
    who: "Desenvolvimento + Marketing + Gerência",
  },
  {
    kind: "decision",
    id: "gate2",
    label: "Estética aprovada?",
    yes: "Segue para avaliação funcional",
    no: "FIM · Reprovado",
    adjust: "Ajustes / nova proposta → volta ao piloto",
  },
  {
    kind: "meeting",
    id: "reuniao3",
    label: "3ª Reunião — Avaliação funcional",
    who: "+ Produção / Encarregados",
    step: "aprov_comercial",
  },
  {
    kind: "decision",
    id: "gate3",
    label: "Funcionalmente aprovado?",
    yes: "Finalizar ficha técnica",
    no: "Reajustes funcionais → volta à ficha e ao piloto",
  },
  {
    kind: "process",
    id: "custos",
    step: "custos",
    sub: "Etiquetas, composição, acabamentos, especificações finais, consumo de materiais",
  },
  {
    kind: "process",
    id: "aprov_diretoria",
    step: "aprov_diretoria",
    sub: "Aprovação final da ficha técnica (Desenvolvimento + Gerência)",
  },
  {
    kind: "process",
    id: "liberacao_pcp",
    step: "liberacao_pcp",
    sub: "Piloto + ficha definitiva + custos enviados ao PCP",
  },
  {
    kind: "process",
    id: "producao",
    step: "producao",
    sub: "Planejamento, programação, liberação das OPs, produção em escala",
  },
  { kind: "end", id: "end", label: "FIM · Produção liberada", tone: "ok" },
];

function findStat(steps: DevFlowStepStat[], step: WorkflowStep) {
  return steps.find((s) => s.step === step);
}

function ProcessCard({
  node,
  stat,
}: {
  node: Extract<FlowNode, { kind: "process" | "meeting" }>;
  stat?: DevFlowStepStat;
}) {
  const meta = node.step ? STEP_META[node.step] : null;
  const active = stat?.active ?? 0;
  const blocked = stat?.blocked ?? 0;
  const hasBlocked = blocked > 0;
  const isMeeting = node.kind === "meeting";

  const body = (
    <div
      className={cn(
        "group relative w-full rounded-xl border bg-card p-3.5 text-left transition",
        "hover:border-primary/50 hover:shadow-md",
        isMeeting
          ? "border-primary/40 bg-primary/5"
          : hasBlocked
            ? "border-rose-500/40"
            : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg shrink-0",
            isMeeting
              ? "bg-primary/15 text-primary"
              : hasBlocked
                ? "bg-rose-500/15 text-rose-600"
                : "bg-muted text-foreground/80",
          )}
        >
          {isMeeting ? (
            <Users className="size-4" />
          ) : meta ? (
            <StepIcon name={meta.icon} className="size-4" />
          ) : (
            <Circle className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-sm truncate">
              {isMeeting ? (node as { label: string }).label : (meta?.label ?? "Etapa")}
            </div>
            {stat && (
              <Badge variant="outline" className="h-5 text-[10px] tabular-nums">
                {active} ativo{active === 1 ? "" : "s"}
              </Badge>
            )}
            {hasBlocked && (
              <Badge className="h-5 text-[10px] bg-rose-500/15 text-rose-600 border-rose-500/30 gap-1">
                <AlertTriangle className="size-2.5" /> {blocked} bloq.
              </Badge>
            )}
          </div>
          {(node.sub || (isMeeting && (node as { who: string }).who)) && (
            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {isMeeting ? (node as { who: string }).who : node.sub}
            </div>
          )}
          {!isMeeting && meta?.role && (
            <div className="text-[10px] text-muted-foreground/80 mt-1 uppercase tracking-wide">
              Responsável: {meta.role}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Deep link para o kanban (visão geral do ciclo)
  if (node.step) {
    return (
      <Link to="/produto-kanban" search={{ q: "", f: "all", scope: "mine" }} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

function DecisionDiamond({ node }: { node: Extract<FlowNode, { kind: "decision" }> }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        <div className="size-6 rotate-45 border-2 border-amber-500 shrink-0" />
        {node.label}
      </div>
      <div className="mt-2 grid gap-1.5 text-[11px]">
        <div className="flex items-start gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 h-5 text-[10px]">
            SIM
          </Badge>
          <span className="text-muted-foreground">{node.yes}</span>
        </div>
        {node.adjust && (
          <div className="flex items-start gap-2">
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 h-5 text-[10px]">
              AJUSTES
            </Badge>
            <span className="text-muted-foreground">{node.adjust}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 h-5 text-[10px]">
            NÃO
          </Badge>
          <span className="text-muted-foreground">{node.no}</span>
        </div>
      </div>
    </div>
  );
}

function EndCap({ node }: { node: Extract<FlowNode, { kind: "start" | "end" }> }) {
  const isStart = node.kind === "start";
  const tone =
    isStart || (node.kind === "end" && node.tone === "ok")
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
      : "bg-rose-500/15 text-rose-600 border-rose-500/40";
  return (
    <div
      className={cn(
        "mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium",
        tone,
      )}
    >
      {isStart ? <Sparkles className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
      {node.label}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1.5 text-muted-foreground/50">
      <ArrowDown className="size-4" />
    </div>
  );
}

export function DevelopmentFlowDiagram() {
  const fn = useServerFn(getDevelopmentFlowStats);
  const q = useQuery({
    queryKey: ["dev-flow-stats"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const stats = q.data;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Produtos no fluxo" value={stats?.in_flow} loading={q.isLoading} />
        <KpiCard label="Bloqueados" value={stats?.blocked} loading={q.isLoading} tone="danger" />
        <KpiCard label="Concluídos" value={stats?.concluded} loading={q.isLoading} tone="ok" />
        <KpiCard label="Total de produtos" value={stats?.total_products} loading={q.isLoading} />
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <LegendDot className="bg-muted border-border" label="Processo" />
        <LegendDot className="bg-primary/15 border-primary/40" label="Reunião" />
        <LegendDot className="bg-amber-500/15 border-amber-500/40" label="Decisão" />
        <LegendDot
          className="bg-emerald-500/15 border-emerald-500/40"
          label="Início / Fim aprovado"
        />
        <LegendDot className="bg-rose-500/15 border-rose-500/40" label="Bloqueado / Reprovado" />
        <span className="ml-auto inline-flex items-center gap-1">
          Clique em uma etapa <ArrowRight className="size-3" /> abre o Kanban filtrado.
        </span>
      </div>

      {/* Diagrama */}
      <div className="mx-auto max-w-2xl space-y-1">
        {FLOW.map((node, idx) => {
          const next = FLOW[idx + 1];
          const isLast = idx === FLOW.length - 1;
          return (
            <div key={node.id}>
              {node.kind === "start" || node.kind === "end" ? (
                <div className="text-center">
                  <EndCap node={node} />
                </div>
              ) : node.kind === "decision" ? (
                <DecisionDiamond node={node} />
              ) : (
                <ProcessCard
                  node={node}
                  stat={
                    node.kind === "process" && stats
                      ? findStat(stats.steps, node.step)
                      : node.kind === "meeting" && node.step && stats
                        ? findStat(stats.steps, node.step)
                        : undefined
                  }
                />
              )}
              {!isLast && next && <Connector />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="h-7 w-14 mt-1" />
      ) : (
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums mt-0.5",
            tone === "ok" && "text-emerald-600 dark:text-emerald-400",
            tone === "danger" && "text-rose-600",
          )}
        >
          {value ?? 0}
        </div>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-3 rounded border", className)} />
      {label}
    </span>
  );
}
