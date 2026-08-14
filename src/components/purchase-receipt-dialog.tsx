import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchaseOrderId: string | null;
  poCode: string;
  userId?: string;
};

type Line = {
  id: string;
  description: string;
  inventory_item_id: string | null;
  quantity: number;
  qty_received: number;
  qty_now: string;
  supplier_lot: string;
};

export function PurchaseReceiptDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  poCode,
  userId,
}: Props) {
  const qc = useQueryClient();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["po-receipt-data", purchaseOrderId],
    enabled: open && !!purchaseOrderId,
    queryFn: async () => {
      const [itemsRes, receiptsRes] = await Promise.all([
        supabase
          .from("purchase_order_items")
          .select("id, description, inventory_item_id, quantity")
          .eq("purchase_order_id", purchaseOrderId!),
        supabase
          .from("purchase_order_receipt_items")
          .select(
            "purchase_order_item_id, qty_received, receipt:purchase_order_receipts!inner(purchase_order_id)",
          )
          .eq("receipt.purchase_order_id", purchaseOrderId!),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (receiptsRes.error) throw receiptsRes.error;
      const received = new Map<string, number>();
      for (const r of receiptsRes.data ?? []) {
        received.set(
          r.purchase_order_item_id,
          (received.get(r.purchase_order_item_id) ?? 0) + Number(r.qty_received),
        );
      }
      return (itemsRes.data ?? []).map((it) => ({
        id: it.id,
        description: it.description,
        inventory_item_id: it.inventory_item_id,
        quantity: Number(it.quantity),
        qty_received: received.get(it.id) ?? 0,
      }));
    },
  });

  useEffect(() => {
    if (!data) return;
    setLines(
      data.map((it) => ({
        ...it,
        qty_now: Math.max(0, it.quantity - it.qty_received).toString(),
        supplier_lot: "",
      })),
    );
  }, [data]);

  useEffect(() => {
    if (!open) {
      setInvoiceNumber("");
      setNotes("");
      setLines([]);
    }
  }, [open]);

  const totalNow = useMemo(
    () => lines.reduce((acc, l) => acc + (Number(l.qty_now) || 0), 0),
    [lines],
  );

  const register = useMutation({
    mutationFn: async () => {
      if (!userId || !purchaseOrderId) throw new Error("Sem contexto");
      const toRegister = lines
        .map((l) => ({ ...l, qty: Number(l.qty_now) || 0 }))
        .filter((l) => l.qty > 0);
      if (toRegister.length === 0) throw new Error("Informe ao menos uma quantidade");
      for (const l of toRegister) {
        const pending = l.quantity - l.qty_received;
        if (l.qty > pending + 0.0001) {
          throw new Error(`Quantidade acima do pendente em "${l.description}"`);
        }
      }
      const { data: rec, error: recErr } = await supabase
        .from("purchase_order_receipts")
        .insert({
          owner_id: userId,
          purchase_order_id: purchaseOrderId,
          invoice_number: invoiceNumber || null,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (recErr) throw recErr;
      const rows = toRegister.map((l) => ({
        owner_id: userId,
        receipt_id: rec.id,
        purchase_order_item_id: l.id,
        qty_received: l.qty,
        supplier_lot: l.supplier_lot || null,
      }));
      const { error: itemsErr } = await supabase.from("purchase_order_receipt_items").insert(rows);
      if (itemsErr) throw itemsErr;
      return rec.id;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado — estoque atualizado");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["po-receipt-data"] });
      qc.invalidateQueries({ queryKey: ["inventory_items"] });
      qc.invalidateQueries({ queryKey: ["material_reservations"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-5 text-primary" /> Registrar recebimento — OC {poCode}
          </DialogTitle>
          <DialogDescription>
            Informe a quantidade recebida por item. Entradas são lançadas no estoque
            automaticamente. Quando todos os itens forem totalmente recebidos, a OC é fechada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Nº da nota fiscal</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ex.: 123456"
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2 w-20">Pedido</th>
                <th className="text-right px-3 py-2 w-24">Já recebido</th>
                <th className="text-right px-3 py-2 w-24">Pendente</th>
                <th className="text-right px-3 py-2 w-28">Receber agora</th>
                <th className="text-left px-3 py-2 w-32">Lote fornec.</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    OC sem itens.
                  </td>
                </tr>
              ) : (
                lines.map((l, i) => {
                  const pending = Math.max(0, l.quantity - l.qty_received);
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.description}</div>
                        {!l.inventory_item_id && (
                          <div className="text-[11px] text-amber-500">
                            Sem item de estoque vinculado — não gera entrada
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.qty_received}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{pending}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={pending}
                          step="0.01"
                          value={l.qty_now}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[i].qty_now = e.target.value;
                            setLines(copy);
                          }}
                          className="h-8 text-right"
                          disabled={pending <= 0}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={l.supplier_lot}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[i].supplier_lot = e.target.value;
                            setLines(copy);
                          }}
                          className="h-8"
                          placeholder="opcional"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-muted-foreground">
          Total a receber neste lançamento: <span className="font-semibold">{totalNow}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => register.mutate()} disabled={register.isPending || totalNow <= 0}>
            {register.isPending ? "Registrando…" : "Registrar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
