import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Boxes, Palette } from "lucide-react";

type Mov = {
  id: string;
  type: "entrada" | "saida" | "ajuste" | "transferencia";
  quantity: number;
  supplier_lot: string | null;
  supplier_color: string | null;
  created_at: string;
  notes: string | null;
};

export function InventoryLotBreakdownButton({
  itemId,
  itemName,
  unit,
}: {
  itemId: string;
  itemName: string;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        title="Saldo por lote/cor do fornecedor"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground"
      >
        <Palette className="size-3.5" />
      </button>
      {open && <LotDialog itemId={itemId} itemName={itemName} unit={unit} onOpenChange={setOpen} />}
    </>
  );
}

function LotDialog({
  itemId,
  itemName,
  unit,
  onOpenChange,
}: {
  itemId: string;
  itemName: string;
  unit: string;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["inventory_lot_breakdown", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, type, quantity, supplier_lot, supplier_color, created_at, notes")
        .eq("inventory_item_id", itemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Mov[];
    },
  });

  // Agrupar por lote × cor
  const groups = new Map<string, { lot: string; color: string; balance: number; lastAt: string }>();
  for (const m of movs) {
    const lot = (m.supplier_lot || "").trim() || "—";
    const color = (m.supplier_color || "").trim() || "—";
    const key = `${lot}|${color}`;
    const sign = m.type === "entrada" ? 1 : m.type === "saida" ? -1 : 0;
    const prev = groups.get(key) ?? { lot, color, balance: 0, lastAt: m.created_at };
    prev.balance += sign * Number(m.quantity || 0);
    if (m.created_at > prev.lastAt) prev.lastAt = m.created_at;
    groups.set(key, prev);
  }
  const rows = Array.from(groups.values())
    .filter((r) => !(r.lot === "—" && r.color === "—" && r.balance === 0))
    .sort((a, b) => b.balance - a.balance);

  const totalRastreado = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="size-4" /> Lotes e cores · {itemName}
          </DialogTitle>
          <DialogDescription>
            Saldo agrupado por <strong>lote do fornecedor × cor</strong> calculado a partir das
            movimentações. Total rastreado:{" "}
            <strong>
              {totalRastreado} {unit}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">
            Nenhuma movimentação informa lote ou cor ainda. Inclua "Lote do fornecedor" e "Cor" ao
            registrar entradas em /movimentacoes.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Lote fornecedor</th>
                  <th className="text-left px-3 py-2">Cor</th>
                  <th className="text-right px-3 py-2">Saldo</th>
                  <th className="text-right px-3 py-2">Últ. movimento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{r.lot}</td>
                    <td className="px-3 py-2">{r.color}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${r.balance < 0 ? "text-destructive" : r.balance === 0 ? "text-muted-foreground" : ""}`}
                    >
                      {r.balance} {unit}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {new Date(r.lastAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
