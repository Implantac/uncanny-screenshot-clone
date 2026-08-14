import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { closeProductionOrder } from "@/lib/production-close.functions";

export function CloseOrderDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  plannedQty,
  invalidateKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  orderCode: string;
  plannedQty: number;
  invalidateKey?: unknown[];
}) {
  const qc = useQueryClient();
  const [produced, setProduced] = useState<string>(String(plannedQty));
  const [rejected, setRejected] = useState<string>("0");
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      closeProductionOrder({
        data: {
          orderId,
          producedQty: Math.max(0, Number(produced) || 0),
          rejectedQty: Math.max(0, Number(rejected) || 0),
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `OP fechada${r.releasedReservations ? ` · ${r.releasedReservations} reserva(s) liberada(s)` : ""}`,
      );
      onOpenChange(false);
      if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ["production_orders"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao fechar OP"),
  });

  const producedNum = Number(produced) || 0;
  const rejectedNum = Number(rejected) || 0;
  const delta = producedNum + rejectedNum - plannedQty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            Fechar OP {orderCode}
          </DialogTitle>
          <DialogDescription>
            Registrar produção final. Reservas de material ativas serão liberadas. O estoque de
            acabado é gerido pelo ERP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Produzido (planejado {plannedQty})</Label>
            <Input
              type="number"
              min={0}
              value={produced}
              onChange={(e) => setProduced(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Refugo / não-conforme</Label>
            <Input
              type="number"
              min={0}
              value={rejected}
              onChange={(e) => setRejected(e.target.value)}
            />
          </div>
          {delta !== 0 && (
            <p className={`text-[11px] ${delta < 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              {delta < 0
                ? `Faltam ${Math.abs(delta)} pç em relação ao planejado.`
                : `+${delta} pç acima do planejado.`}
            </p>
          )}
          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: 3 peças com falha de tingimento no lote"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Fechando…" : "Confirmar fechamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
