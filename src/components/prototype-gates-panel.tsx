import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Clock, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  GATES,
  GATE_LABEL,
  decideGate,
  getGates,
  type GateKey,
  type GateStatus,
} from "@/lib/prototype-gates.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_TONE: Record<GateStatus, string> = {
  pendente: "border-border text-muted-foreground bg-card",
  aprovado: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  reprovado: "border-red-500/40 text-red-700 bg-red-500/10",
};

export function PrototypeGatesPanel({ prototypeId }: { prototypeId: string }) {
  const qc = useQueryClient();
  const getGatesFn = useServerFn(getGates);
  const decideFn = useServerFn(decideGate);
  const [dialog, setDialog] = useState<{
    gate: GateKey;
    status: Exclude<GateStatus, "pendente">;
  } | null>(null);
  const [notes, setNotes] = useState("");

  const { data: gates, isLoading } = useQuery({
    queryKey: ["proto-gates", prototypeId],
    queryFn: () => getGatesFn({ data: { prototypeId } }),
  });

  const decide = useMutation({
    mutationFn: (input: { gate: GateKey; status: GateStatus; notes?: string }) =>
      decideFn({ data: { prototypeId, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proto-gates", prototypeId] });
      qc.invalidateQueries({ queryKey: ["prototipo", prototypeId] });
      toast.success("Gate atualizado");
      setDialog(null);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <div className="text-sm font-semibold">Gates de aprovação</div>
        <span className="text-[11px] text-muted-foreground ml-auto">
          Cada selo libera o próximo
        </span>
      </div>

      {isLoading || !gates ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Carregando…
        </div>
      ) : (
        <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {gates.map((g, i) => (
            <li
              key={g.gate}
              className={`rounded-lg border p-3 flex flex-col gap-2 ${STATUS_TONE[g.status]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono opacity-70">{i + 1}</span>
                {g.status === "aprovado" ? (
                  <Check className="size-3.5" />
                ) : g.status === "reprovado" ? (
                  <X className="size-3.5" />
                ) : (
                  <Clock className="size-3.5" />
                )}
              </div>
              <div className="text-xs font-semibold leading-tight">
                {GATE_LABEL[g.gate as GateKey]}
              </div>
              {g.decided_at && (
                <div className="text-[10px] opacity-70">
                  {new Date(g.decided_at).toLocaleDateString("pt-BR")}
                </div>
              )}
              {g.notes && (
                <div className="text-[11px] line-clamp-2 opacity-80">{g.notes}</div>
              )}
              <div className="flex gap-1 mt-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] flex-1 hover:bg-emerald-500/20"
                  onClick={() => setDialog({ gate: g.gate as GateKey, status: "aprovado" })}
                  disabled={g.status === "aprovado"}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] flex-1 hover:bg-red-500/20"
                  onClick={() => setDialog({ gate: g.gate as GateKey, status: "reprovado" })}
                  disabled={g.status === "reprovado"}
                >
                  Reprovar
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.status === "aprovado" ? "Aprovar" : "Reprovar"} ·{" "}
              {dialog && GATE_LABEL[dialog.gate]}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Observação (opcional) — motivo, condicionantes, próximos passos"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              disabled={decide.isPending}
              onClick={() =>
                dialog &&
                decide.mutate({ gate: dialog.gate, status: dialog.status, notes })
              }
            >
              {decide.isPending && <Loader2 className="size-3 mr-1 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
