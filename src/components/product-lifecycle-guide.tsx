import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  listProductWorkflow,
  STEP_META,
  type WorkflowStep,
  type WorkflowRow,
} from "@/lib/product-workflow.functions";
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
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Play,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  PenTool,
  FileText,
  DollarSign,
  Scissors,
  ShoppingBag,
  Crown,
  ShieldCheck,
  Factory,
};

type StepStatus = "pendente" | "em_andamento" | "concluido" | "bloqueado";

interface StepState {
  step: WorkflowStep;
  order: number;
  label: string;
  icon: string;
  role: string;
  status: StepStatus;
  isCurrent: boolean;
  blockerReason: string | null;
}

/**
 * ProductLifecycleGuide — Barra horizontal que mostra o ciclo completo
 * de vida do produto em 9 etapas, com destaque na etapa atual,
 * blockers visíveis e call-to-action para o próximo passo.
 *
 * Design: Timeline horizontal responsiva com cards expansíveis.
 */
export function ProductLifecycleGuide({ productId }: { productId: string }) {
  const [expanded, setExpanded] = useState(false);
  const list = useServerFn(listProductWorkflow);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["product-workflow", productId],
    queryFn: () => list({ data: { productId } }),
    staleTime: 15_000,
  });

  const steps: StepState[] = useMemo(() => {
    if (!rows) return [];
    return rows.map((r: WorkflowRow) => ({
      step: r.step,
      order: r.step_order,
      label: STEP_META[r.step].label,
      icon: STEP_META[r.step].icon,
      role: STEP_META[r.step].role,
      status: r.status as StepStatus,
      isCurrent: r.status === "em_andamento" || r.status === "bloqueado",
      blockerReason: r.blocker_reason,
    }));
  }, [rows]);

  const currentStep = steps.find((s) => s.isCurrent);
  const currentIndex = steps.findIndex((s) => s.isCurrent);
  const doneCount = steps.filter((s) => s.status === "concluido").length;
  const totalCount = steps.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const blocked = currentStep?.status === "bloqueado";
  const blockers = currentStep?.blockerReason
    ? currentStep.blockerReason.split("\n").filter(Boolean)
    : [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando ciclo de vida…
      </div>
    );
  }

  if (!steps.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <Play className="size-4" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2">
              Ciclo de Vida do Produto
              <Badge variant="outline" className="text-[10px]">
                {doneCount}/{totalCount}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {currentStep
                ? `Etapa atual: ${currentStep.label} · ${progressPct}% concluído`
                : doneCount === totalCount
                  ? "🎉 Ciclo completo! Produto em produção."
                  : "Aguardando início do workflow"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mini barra de progresso */}
          <div className="hidden sm:block w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${blocked ? "bg-rose-500" : "bg-primary"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Blockers banner */}
          {blocked && blockers.length > 0 && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
              <div className="flex items-center gap-2 text-rose-600 font-medium text-sm">
                <AlertTriangle className="size-4" />
                Etapa bloqueada — resolva os itens abaixo para avançar
              </div>
              <ul className="mt-2 text-xs text-rose-700/90 dark:text-rose-300/90 list-disc pl-5 space-y-0.5">
                {blockers.slice(0, 6).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline horizontal — desktop */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Linha conectora */}
              <div className="absolute top-5 left-6 right-6 h-0.5 bg-muted">
                <div
                  className={`h-full transition-all ${blocked ? "bg-rose-500" : "bg-primary"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {steps.map((s, idx) => {
                  const Icon = ICONS[s.icon] ?? Circle;
                  const isDone = s.status === "concluido";
                  const isCurrent = s.isCurrent;
                  const isBlocked = s.status === "bloqueado";
                  const isPending = s.status === "pendente";

                  return (
                    <TooltipProvider key={s.step}>
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-1.5 group cursor-default">
                            {/* Círculo do step */}
                            <div
                              className={cn(
                                "size-10 rounded-full flex items-center justify-center border-2 transition-all relative z-10",
                                isDone &&
                                  "bg-emerald-500/15 border-emerald-500 text-emerald-600",
                                isCurrent &&
                                  !isBlocked &&
                                  "bg-primary/15 border-primary text-primary ring-2 ring-primary/20",
                                isBlocked &&
                                  "bg-rose-500/15 border-rose-500 text-rose-600 ring-2 ring-rose-500/20",
                                isPending &&
                                  "bg-muted border-border text-muted-foreground",
                              )}
                            >
                              {isDone ? (
                                <CheckCircle2 className="size-5" />
                              ) : isBlocked ? (
                                <AlertTriangle className="size-4" />
                              ) : (
                                <Icon className="size-4" />
                              )}
                            </div>
                            {/* Label */}
                            <span
                              className={cn(
                                "text-[10px] font-medium text-center max-w-[80px] leading-tight",
                                isCurrent && !isBlocked && "text-primary",
                                isBlocked && "text-rose-600",
                                isDone && "text-emerald-600",
                                isPending && "text-muted-foreground",
                              )}
                            >
                              {s.label}
                            </span>
                            {/* Número da etapa */}
                            <span className="text-[9px] text-muted-foreground/60">
                              {idx + 1}/{totalCount}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <div className="text-xs space-y-1">
                            <div className="font-medium">{s.label}</div>
                            <div className="text-muted-foreground">Responsável: {s.role}</div>
                            <div className="text-muted-foreground">
                              {isDone && "✅ Concluído"}
                              {isCurrent && !isBlocked && "⏳ Em andamento"}
                              {isBlocked && "🚫 Bloqueado"}
                              {isPending && "⏸️ Pendente"}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Timeline vertical — mobile/tablet */}
          <div className="lg:hidden">
            <div className="relative pl-8 space-y-0">
              {/* Linha vertical */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-muted" />

              {steps.map((s, idx) => {
                const Icon = ICONS[s.icon] ?? Circle;
                const isDone = s.status === "concluido";
                const isCurrent = s.isCurrent;
                const isBlocked = s.status === "bloqueado";

                return (
                  <div key={s.step} className="relative pb-4 last:pb-0">
                    {/* Círculo */}
                    <div
                      className={cn(
                        "absolute -left-[23px] size-7 rounded-full border-2 flex items-center justify-center bg-card z-10",
                        isDone && "border-emerald-500 bg-emerald-500/10",
                        isCurrent && !isBlocked && "border-primary bg-primary/10",
                        isBlocked && "border-rose-500 bg-rose-500/10",
                        !isDone && !isCurrent && "border-border bg-card",
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                      ) : isBlocked ? (
                        <AlertTriangle className="size-3 text-rose-600" />
                      ) : (
                        <Icon className="size-3.5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div
                          className={cn(
                            "text-xs font-medium",
                            isCurrent && !isBlocked && "text-primary",
                            isBlocked && "text-rose-600",
                            isDone && "text-emerald-600",
                          )}
                        >
                          {s.order}. {s.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.role}
                          {isDone && " · Concluído"}
                          {isCurrent && !isBlocked && " · Em andamento"}
                          {isBlocked && " · Bloqueado"}
                        </div>
                      </div>
                      {s.isCurrent && !isBlocked && (
                        <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
                          Atual
                        </Badge>
                      )}
                      {isBlocked && (
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-rose-500/10 text-rose-600 border-rose-500/20"
                        >
                          Bloqueado
                        </Badge>
                      )}
                      {isDone && (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Call-to-action buttons por etapa */}
          <div className="border-t border-border pt-3 mt-2">
            <div className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Ações rápidas por etapa
            </div>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((s) => {
                const isDone = s.status === "concluido";
                const isCurrent = s.isCurrent;
                const isBlocked = s.status === "bloqueado";
                const isPending = s.status === "pendente";

                return (
                  <StepActionCard
                    key={s.step}
                    step={s}
                    isDone={isDone}
                    isCurrent={isCurrent}
                    isBlocked={isBlocked}
                    isPending={isPending}
                    productId={productId}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepActionCard({
  step,
  isDone,
  isCurrent,
  isBlocked,
  isPending,
  productId,
}: {
  step: StepState;
  isDone: boolean;
  isCurrent: boolean;
  isBlocked: boolean;
  isPending: boolean;
  productId: string;
}) {
  const Icon = ICONS[step.icon] ?? Circle;

  // Mapeia cada etapa para uma ação/link relevante
  const action = getStepAction(step.step, productId);

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 min-w-[140px] flex-1 basis-[130px]",
        isDone && "border-emerald-500/30 bg-emerald-500/5",
        isCurrent && !isBlocked && "border-primary/40 bg-primary/5",
        isBlocked && "border-rose-500/40 bg-rose-500/10",
        isPending && "border-border bg-card opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {isDone ? (
          <CheckCircle2 className="size-3 text-emerald-600" />
        ) : isBlocked ? (
          <AlertTriangle className="size-3 text-rose-600" />
        ) : isCurrent ? (
          <Play className="size-3 text-primary" />
        ) : (
          <Lock className="size-3 text-muted-foreground/50" />
        )}
        <Icon
          className={cn(
            "size-3",
            isDone && "text-emerald-600",
            isCurrent && !isBlocked && "text-primary",
            isBlocked && "text-rose-600",
            isPending && "text-muted-foreground/50",
          )}
        />
        <span
          className={cn(
            "text-[10px] font-medium",
            isDone && "text-emerald-700 dark:text-emerald-400",
            isCurrent && !isBlocked && "text-primary",
            isBlocked && "text-rose-700 dark:text-rose-400",
            isPending && "text-muted-foreground/60",
          )}
        >
          {step.label}
        </span>
      </div>

      {action && (isCurrent || isBlocked) && (
        <Link
          to={action.to}
          search={action.search}
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1"
        >
          {action.label} <ArrowRight className="size-2.5" />
        </Link>
      )}

      {isDone && action && (
        <Link
          to={action.to}
          search={action.search}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-1"
        >
          Ver detalhes <ArrowRight className="size-2.5" />
        </Link>
      )}

      {isPending && (
        <div className="text-[9px] text-muted-foreground/50 mt-1">
          Aguardando etapa anterior
        </div>
      )}
    </div>
  );
}

function getStepAction(
  step: WorkflowStep,
  productId: string,
): { to: string; label: string; search?: Record<string, string> } | null {
  switch (step) {
    case "concepcao":
      return {
        to: "/produto/$id",
        label: "Editar produto",
        search: { tab: "overview" },
      };
    case "modelagem":
      return {
        to: "/produto/$id",
        label: "Ir para CAD",
        search: { tab: "overview" },
      };
    case "engenharia":
      return {
        to: "/ficha-tecnica",
        label: "Abrir ficha técnica",
        search: { productId },
      };
    case "custos":
      return {
        to: "/produto/$id",
        label: "Ver custos",
        search: { tab: "custos" },
      };
    case "piloto":
      return {
        to: "/produto/$id",
        label: "Ver protótipos",
        search: { tab: "prototipos" },
      };
    case "aprov_comercial":
      return { to: "/approvals", label: "Ver aprovações" };
    case "aprov_diretoria":
      return { to: "/approvals", label: "Ver aprovações" };
    case "liberacao_pcp":
      return {
        to: "/produto/$id",
        label: "Ir para PCP",
        search: { tab: "pcp" },
      };
    case "producao":
      return {
        to: "/produto/$id",
        label: "Acompanhar produção",
        search: { tab: "pcp" },
      };
    default:
      return null;
  }
}

