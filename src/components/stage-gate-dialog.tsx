import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ShieldAlert, Info } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  evaluateStageGates,
  columnToStage,
  type GateCheck,
} from "@/lib/pcp-gates.functions";

const ICON: Record<GateCheck["status"], React.ReactNode> = {
  pass: <CheckCircle2 className="size-4 text-emerald-500" />,
  warn: <AlertTriangle className="size-4 text-amber-500" />,
  fail: <XCircle className="size-4 text-destructive" />,
};

/**
 * Pré-flight dialog: avalia gates antes de avançar a OP.
 * Mostra checks com explicabilidade e exige justificativa de supervisor para override.
 */
export function StageGateDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  toColumn,
  toLabel,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  orderCode: string;
  toColumn: string;
  toLabel: string;
  onConfirm: (args: { overrideReason?: string }) => void;
  pending: boolean;
}) {
  const evalFn = useServerFn(evaluateStageGates);
  const toStage = columnToStage(toColumn) ?? toColumn;
  const q = useQuery({
    queryKey: ["stage-gates", orderId, toStage],
    queryFn: () => evalFn({ data: { orderId, toStage } }),
    enabled: open,
    staleTime: 5_000,
  });
  const [override, setOverride] = useState("");

  const failed = (q.data?.checks ?? []).filter((c) => c.blocking && c.status === "fail");
  const needsOverride = failed.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            Validação de etapa — {orderCode}
          </DialogTitle>
          <DialogDescription>
            Avançando para <span className="font-medium text-foreground">{toLabel}</span>. A IA
            valida pré-condições antes de mover a OP.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Avaliando gates…
          </div>
        ) : q.error ? (
          <div className="text-sm text-destructive">
            Falha ao avaliar: {(q.error as Error).message}
          </div>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-auto">
            {q.data?.checks.length === 0 && (
              <li className="text-xs text-muted-foreground">
                Nenhum gate definido para esta etapa.
              </li>
            )}
            {q.data?.checks.map((c) => (
              <li
                key={c.key}
                className="rounded-md border border-border bg-card p-2.5 space-y-1.5"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{ICON[c.status]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {c.label}
                      {c.blocking && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                          obrigatório
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.message}</div>
                    <div className="text-[11px] text-muted-foreground/80 inline-flex items-start gap-1 mt-1">
                      <Info className="size-3 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium">Por quê:</span> {c.reason}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {needsOverride && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="text-xs font-medium text-destructive">
              Override de supervisor — justifique o motivo (será registrado em auditoria)
            </div>
            <Textarea
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="Ex.: lote piloto autorizado pela coordenação para teste de capacidade."
              rows={2}
              className="text-xs"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                overrideReason: needsOverride ? override.trim() : undefined,
              })
            }
            disabled={
              pending || q.isLoading || (needsOverride && override.trim().length < 8)
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            {needsOverride ? "Forçar avanço (override)" : "Confirmar avanço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
