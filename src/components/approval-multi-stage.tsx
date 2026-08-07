import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  SkipForward,
  RotateCcw,
  ShieldCheck,
  Loader2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  APPROVAL_STAGES,
  listApprovalWorkflow,
  sendApprovalWorkflow,
  decideApprovalWorkflow,
  skipApprovalWorkflow,
  cancelApprovalWorkflow,
  resetApprovalWorkflow,
  type ApprovalRow,
} from "@/lib/approval-workflow.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { canApproveSheet } from "@/lib/permissions";

type Props = {
  techSheetId: string;
  ownerId: string;
};

const STATUS_META: Record<
  ApprovalRow["status"],
  {
    label: string;
    badge: "default" | "success" | "destructive" | "warning" | "info" | "outline";
    dot: string;
  }
> = {
  pendente: { label: "Pendente", badge: "outline", dot: "bg-muted-foreground" },
  em_analise: { label: "Em análise", badge: "info", dot: "bg-sky-500" },
  aprovado: { label: "Aprovado", badge: "success", dot: "bg-emerald-500" },
  reprovado: { label: "Reprovado", badge: "destructive", dot: "bg-red-500" },
  pulado: { label: "Pulado", badge: "warning", dot: "bg-amber-500" },
  cancelado: { label: "Cancelado", badge: "outline", dot: "bg-muted-foreground" },
};

/** Busca o nome de perfil (best-effort) para aprovações atribuídas. */
function useProfileName(userId: string | null) {
  return useQuery({
    queryKey: ["profile-name", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      return (data?.full_name as string | null) ?? null;
    },
    enabled: !!userId,
  });
}

export function ApprovalMultiStage({ techSheetId, ownerId }: Props) {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listApprovalWorkflow);
  const sendFn = useServerFn(sendApprovalWorkflow);
  const decideFn = useServerFn(decideApprovalWorkflow);
  const skipFn = useServerFn(skipApprovalWorkflow);
  const cancelFn = useServerFn(cancelApprovalWorkflow);
  const resetFn = useServerFn(resetApprovalWorkflow);

  const listKey = ["approval-workflow", techSheetId];

  const { data: steps = [], isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => listFn({ data: { techSheetId } }) as Promise<ApprovalRow[]>,
  });

  const [decideTarget, setDecideTarget] = useState<(ApprovalRow & { label: string }) | null>(null);
  const [decision, setDecision] = useState<"aprovado" | "reprovado">("aprovado");
  const [comment, setComment] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: listKey });
    qc.invalidateQueries({ queryKey: ["tech_sheets"] });
  };

  const send = useMutation({
    mutationFn: () => sendFn({ data: { techSheetId } }),
    onSuccess: () => {
      toast.success("Fluxo enviado para a próxima etapa.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMut = useMutation({
    mutationFn: () =>
      decideFn({
        data: { techSheetId, stage: decideTarget!.stage, decision, comment: comment || undefined },
      }),
    onSuccess: () => {
      toast.success(
        decision === "aprovado"
          ? "Etapa aprovada."
          : "Etapa reprovada — ficha destravada para correção.",
      );
      setDecideTarget(null);
      setComment("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skip = useMutation({
    mutationFn: (stage: number) => skipFn({ data: { techSheetId, stage } }),
    onSuccess: () => {
      toast.success("Etapa pulada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (stage: number) => cancelFn({ data: { techSheetId, stage } }),
    onSuccess: () => {
      toast.success("Etapa cancelada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { techSheetId } }),
    onSuccess: () => {
      toast.success("Fluxo redefinido para o início.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwner = user?.id === ownerId;
  // RBAC: apenas quem pode aprovar (admin/gerente) e é dono pode iniciar/gerir o fluxo.
  const canApprove = isOwner && canApproveSheet(roles);

  const enriched = useMemo(
    () =>
      steps.map((s) => {
        const def = APPROVAL_STAGES.find((a) => a.stage === s.stage);
        return { ...s, label: def?.label ?? `Etapa ${s.stage}`, role: def?.role ?? s.role };
      }),
    [steps],
  );

  const doneCount = enriched.filter((s) => ["aprovado", "pulado"].includes(s.status)).length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho + progresso */}
      <div className="rounded-xl border border-border bg-background/30 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Fluxo de aprovação da ficha
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Estilo → Modelagem → Compras → Custos → Qualidade → Diretoria → Liberação
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canApprove && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
              >
                <RotateCcw className="size-3.5" /> Reiniciar fluxo
              </Button>
            )}
            {canApprove && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => send.mutate()}
                disabled={send.isPending || progress >= 100}
              >
                {send.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Enviar para aprovação
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {doneCount} de {steps.length} etapas concluídas
            </span>
            <span className="text-xs font-mono tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cards por etapa */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando fluxo…</div>
      ) : enriched.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma etapa configurada para esta ficha.
        </div>
      ) : (
        <div className="space-y-2">
          {enriched.map((s) => (
            <StageCard
              key={s.id}
              step={s}
              canDecide={s.status === "em_analise"}
              canSend={canApprove && s.status === "pendente"}
              userId={user?.id}
              onDecide={() => {
                setDecideTarget(s);
                setDecision("aprovado");
                setComment("");
              }}
              onSkip={() => skip.mutate(s.stage)}
              onCancel={() => cancel.mutate(s.stage)}
            />
          ))}
        </div>
      )}

      {/* Modal de decisão */}
      <Dialog open={!!decideTarget} onOpenChange={(o) => !o && setDecideTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision === "aprovado" ? "Aprovar etapa" : "Reprovar etapa"} · {decideTarget?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={decision === "aprovado" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDecision("aprovado")}
              >
                <CheckCircle2 className="size-3.5" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant={decision === "reprovado" ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => setDecision("reprovado")}
              >
                <XCircle className="size-3.5" /> Reprovar
              </Button>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">
                {decision === "reprovado"
                  ? "Justificativa obrigatória — a reprovação destrava a ficha para correção."
                  : "Comentário (opcional) para registro da decisão."}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  decision === "reprovado"
                    ? "Ex.: medidas fora de tolerância no busto…"
                    : "Ex.: liberada para corte do piloto…"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant={decision === "reprovado" ? "destructive" : "default"}
              onClick={() => decideMut.mutate()}
              disabled={decideMut.isPending || (decision === "reprovado" && !comment.trim())}
            >
              {decideMut.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : decision === "aprovado" ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <XCircle className="size-3.5" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageCard({
  step,
  canDecide,
  canSend,
  userId,
  onDecide,
  onSkip,
  onCancel,
}: {
  step: ApprovalRow & { label: string };
  canDecide: boolean;
  canSend: boolean;
  userId?: string;
  onDecide: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const meta = STATUS_META[step.status];
  const { data: assignedName } = useProfileName(step.assigned_to);
  const isMine = !!userId && step.assigned_to === userId;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {/* Indicador de status */}
        <div className="flex flex-col items-center pt-0.5">
          <div className={`size-3 rounded-full ${meta.dot} ring-4 ring-background`} />
          {step.stage < 7 && <div className="w-px flex-1 bg-border my-1" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                {step.stage}
              </span>
              <span className="text-sm font-medium">{step.label}</span>
              <Badge variant={meta.badge} className="gap-1">
                {step.status === "em_analise" ? (
                  <Clock className="size-3" />
                ) : step.status === "aprovado" ? (
                  <CheckCircle2 className="size-3" />
                ) : step.status === "reprovado" ? (
                  <XCircle className="size-3" />
                ) : null}
                {meta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              {canSend && (
                <Button size="xs" variant="outline" className="gap-1" onClick={onSkip}>
                  <SkipForward className="size-3.5" /> Pular
                </Button>
              )}
              {canSend && (
                <Button size="xs" variant="outline" className="gap-1" onClick={onCancel}>
                  <XCircle className="size-3.5" /> Cancelar
                </Button>
              )}
              {canDecide && isMine && (
                <Button size="xs" className="gap-1" onClick={onDecide}>
                  <ShieldCheck className="size-3.5" /> Decidir
                </Button>
              )}
              {canDecide && !isMine && (
                <span className="text-[11px] text-muted-foreground">aguardando o responsável</span>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" />
              {assignedName ?? (step.assigned_to ? "Responsável" : "A definir")}
            </span>
            {step.sent_at && <span>Envio: {new Date(step.sent_at).toLocaleString("pt-BR")}</span>}
            {step.decided_at && (
              <span>Decisão: {new Date(step.decided_at).toLocaleString("pt-BR")}</span>
            )}
          </div>

          {step.comment && (
            <div className="mt-2 rounded-lg bg-muted/40 border border-border/60 px-3 py-2 text-xs text-muted-foreground">
              {step.comment}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
