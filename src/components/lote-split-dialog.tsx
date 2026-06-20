import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Split, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { splitProductionOrder } from "@/lib/pcp-advanced.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Supplier = { id: string; name: string };

type Split = {
  quantity: number;
  supplierId: string | null;
  dueDate: string | null;
};

export function LoteSplitDialog({
  orderId,
  orderCode,
  totalQty,
  defaultSupplierId,
  defaultDueDate,
  suppliers,
}: {
  orderId: string;
  orderCode: string;
  totalQty: number;
  defaultSupplierId: string | null;
  defaultDueDate: string | null;
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  const [splits, setSplits] = useState<Split[]>([
    { quantity: Math.floor(totalQty / 2), supplierId: defaultSupplierId, dueDate: defaultDueDate },
    { quantity: Math.ceil(totalQty / 2), supplierId: defaultSupplierId, dueDate: defaultDueDate },
  ]);
  const qc = useQueryClient();
  const splitFn = useServerFn(splitProductionOrder);

  const total = splits.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const remaining = totalQty - total;

  const mut = useMutation({
    mutationFn: () =>
      splitFn({
        data: {
          orderId,
          splits: splits.map((s) => ({
            quantity: Number(s.quantity),
            supplierId: s.supplierId ?? null,
            dueDate: s.dueDate ?? null,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`OP dividida em ${r.childIds.length} sub-lotes (${r.totalSplit} pç)`);
      qc.invalidateQueries({ queryKey: ["pcp"] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addSplit() {
    if (splits.length >= 10) return;
    setSplits([...splits, { quantity: 0, supplierId: defaultSupplierId, dueDate: defaultDueDate }]);
  }

  function rmSplit(i: number) {
    setSplits(splits.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<Split>) {
    setSplits(splits.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        title="Dividir lote (split)"
        onClick={() => setOpen(true)}
      >
        <Split className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Split className="size-4 text-primary" />
              Dividir OP {orderCode} ({totalQty} pç)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Cada sub-lote vira uma OP-filho vinculada à OP-pai. Útil para distribuir entre
              múltiplas facções, células ou prazos.
            </p>
            <div className="space-y-2">
              {splits.map((s, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr_140px_auto] gap-2 items-end">
                  <div>
                    <Label className="text-[10px]">Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      value={s.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Facção</Label>
                    <Select
                      value={s.supplierId ?? "none"}
                      onValueChange={(v) => update(i, { supplierId: v === "none" ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem facção —</SelectItem>
                        {suppliers.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Prazo</Label>
                    <Input
                      type="date"
                      value={s.dueDate ?? ""}
                      onChange={(e) => update(i, { dueDate: e.target.value || null })}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => rmSplit(i)}
                    disabled={splits.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addSplit}
              disabled={splits.length >= 10}
              className="w-full"
            >
              <Plus className="size-4 mr-1" /> Adicionar sub-lote
            </Button>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs flex justify-between">
              <span>
                Soma: <strong className="tabular-nums">{total}</strong> de {totalQty} pç
              </span>
              <span
                className={
                  remaining < 0
                    ? "text-destructive"
                    : remaining === 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                }
              >
                {remaining < 0
                  ? `Excede em ${-remaining}`
                  : remaining === 0
                    ? "Total exato ✓"
                    : `Sobra ${remaining} pç (ficam na OP-pai)`}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || total <= 0 || remaining < 0 || splits.some((s) => s.quantity <= 0)}
            >
              {mut.isPending ? "Dividindo…" : `Dividir em ${splits.length} sub-lotes`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
