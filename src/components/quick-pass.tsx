import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";

type Props = {
  orderId: string;
  orderCode: string;
  ownerId: string;
  fromStage: string;
  toStage: string;
  remaining: number;
};

/** Botão + popover para criar uma OS rápida (parcial ou integral) entre setores. */
export function QuickPassButton({ orderId, orderCode, ownerId, fromStage, toStage, remaining }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<number>(remaining);
  const [supplierId, setSupplierId] = useState<string>("");

  const create = useMutation({
    mutationFn: async () => {
      const kind = qty < remaining ? "parcial" : "integral";
      const code = `OS-${orderCode}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const { error } = await supabase.from("service_orders").insert({
        owner_id: ownerId,
        production_order_id: orderId,
        code,
        kind,
        quantity: qty,
        from_stage: fromStage,
        to_stage: toStage,
        supplier_id: supplierId || null,
        status: "enviada",
        sent_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Passagem ${qty < remaining ? "parcial" : "integral"} criada (${qty} pç → ${toStage})`);
      qc.invalidateQueries({ queryKey: ["pcp-kanban"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={`Passagem rápida → ${toStage}`}
        className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary hover:text-primary-foreground transition"
      >
        <Send className="size-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-popover shadow-lg p-3 space-y-2">
            <div className="text-[11px] font-semibold">Passagem rápida</div>
            <div className="text-[10px] text-muted-foreground">
              {orderCode} · {fromStage} → <strong>{toStage}</strong>
            </div>
            <div className="flex gap-1">
              {[
                { label: "1/4", v: Math.max(1, Math.floor(remaining / 4)) },
                { label: "Metade", v: Math.max(1, Math.floor(remaining / 2)) },
                { label: "Tudo", v: remaining },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setQty(p.v)}
                  className={`flex-1 text-[10px] py-1 rounded border transition ${
                    qty === p.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {p.label} ({p.v})
                </button>
              ))}
            </div>
            <label className="block text-[10px] text-muted-foreground">
              Quantidade ({remaining} restantes)
              <input
                type="number"
                min={1}
                max={remaining}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(remaining, Number(e.target.value) || 0)))}
                className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1"
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Fornecedor (opcional)
              <input
                type="text"
                placeholder="UUID do fornecedor ou vazio"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1 font-mono"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || qty < 1}
                className="flex-1 text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {qty < remaining ? "Enviar parcial" : "Enviar integral"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1.5 rounded border border-border hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
