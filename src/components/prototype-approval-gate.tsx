import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, ShieldAlert, XCircle } from "lucide-react";
import {
  APPROVAL_ROLES,
  APPROVAL_ROLE_LABEL,
  getPrototypeApprovals,
  revokePrototypeApproval,
  upsertPrototypeApproval,
  type ApprovalContext,
  type ApprovalRole,
} from "@/lib/prototype-approvals.functions";
import { Button } from "@/components/ui/button";

export function PrototypeApprovalGate({
  prototypeId,
  currentStage,
}: {
  prototypeId: string;
  currentStage: string;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getPrototypeApprovals);
  const upsertFn = useServerFn(upsertPrototypeApproval);
  const revokeFn = useServerFn(revokePrototypeApproval);

  const { data, isLoading } = useQuery<ApprovalContext>({
    queryKey: ["prototype-approvals", prototypeId],
    queryFn: () => getFn({ data: { prototypeId } }),
    staleTime: 30_000,
  });

  const [busy, setBusy] = useState<ApprovalRole | null>(null);

  const upsert = useMutation({
    mutationFn: (role: ApprovalRole) => upsertFn({ data: { prototypeId, role } }),
    onMutate: (role) => setBusy(role),
    onSettled: () => setBusy(null),
    onSuccess: (_d, role) => {
      toast.success(`Selo de ${APPROVAL_ROLE_LABEL[role]} registrado`);
      qc.invalidateQueries({ queryKey: ["prototype-approvals", prototypeId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revoke = useMutation({
    mutationFn: (role: ApprovalRole) => revokeFn({ data: { prototypeId, role } }),
    onMutate: (role) => setBusy(role),
    onSettled: () => setBusy(null),
    onSuccess: (_d, role) => {
      toast.success(`Selo de ${APPROVAL_ROLE_LABEL[role]} removido`);
      qc.invalidateQueries({ queryKey: ["prototype-approvals", prototypeId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        Carregando aprovações…
      </div>
    );
  }

  const costPct =
    data.costGap != null ? Math.round(data.costGap * 1000) / 10 : null;
  const costColor =
    costPct == null
      ? "text-muted-foreground"
      : costPct > 10
        ? "text-destructive"
        : costPct > 0
          ? "text-amber-400"
          : "text-emerald-400";

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Gate de aprovação</h3>
        </div>
        <div className="text-xs">
          {data.canPromote ? (
            <span className="text-emerald-400">Pronto para promover</span>
          ) : currentStage === "aprovado" ? (
            <span className="text-muted-foreground">Já aprovado</span>
          ) : (
            <span className="text-amber-400">
              Faltam {data.missing.length} selo{data.missing.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {(data.currentCost != null || data.targetCost != null) && (
        <div className="rounded border border-border/60 bg-background/40 px-3 py-2 text-xs flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Custo</div>
            <div className="tabular-nums font-medium">
              {data.currentCost != null
                ? `R$ ${data.currentCost.toFixed(2)}`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Meta</div>
            <div className="tabular-nums font-medium">
              {data.targetCost != null
                ? `R$ ${data.targetCost.toFixed(2)}`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Gap</div>
            <div className={`tabular-nums font-medium ${costColor}`}>
              {costPct == null ? "—" : `${costPct > 0 ? "+" : ""}${costPct}%`}
            </div>
          </div>
          {costPct != null && costPct > 10 && (
            <div className="ml-auto text-[11px] text-destructive">
              Acima da meta — registre justificativa no selo de Custo.
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-2">
        {APPROVAL_ROLES.map((role) => {
          const got = data.approvals.find((a) => a.role === role);
          return (
            <div
              key={role}
              className={`rounded border px-3 py-2 ${
                got
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-border bg-background/40"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                {got ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                {APPROVAL_ROLE_LABEL[role]}
              </div>
              {got ? (
                <>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(got.approvedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                    disabled={busy === role}
                    onClick={() => revoke.mutate(role)}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Revogar
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-[11px] w-full"
                  disabled={busy === role}
                  onClick={() => upsert.mutate(role)}
                >
                  Registrar selo
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!data.canPromote && currentStage !== "aprovado" && (
        <p className="text-[11px] text-muted-foreground">
          O sistema bloqueia a promoção para "Aprovado" até os 3 selos estarem
          registrados. Cada selo grava custo e meta vigentes para auditoria.
        </p>
      )}
    </div>
  );
}
