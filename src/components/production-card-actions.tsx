import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MoreVertical,
  ArrowRight,
  Gauge,
  AlertOctagon,
  MessageSquare,
  History,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { moveOrderToColumn } from "@/lib/production-tracking.functions";
import { setProductionProgress } from "@/lib/pcp-quick.functions";
import { ProductionOccurrenceButton } from "@/components/production-occurrence";
import { ProductionOrderCommentsButton } from "@/components/production-order-comments";

export type CardActionOrder = {
  id: string;
  code: string;
  batch_code: string | null;
  owner_id: string;
  quantity: number;
  progress: number;
};

export function ProductionCardActions({
  order,
  nextColumnKey,
  nextColumnLabel,
  onOpenHistory,
  onOpenSheet,
  invalidateKey,
}: {
  order: CardActionOrder;
  nextColumnKey: string | null;
  nextColumnLabel: string | null;
  onOpenHistory: () => void;
  onOpenSheet?: () => void;
  invalidateKey: unknown[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [qty, setQty] = useState<string>(
    String(Math.round(((order.progress ?? 0) / 100) * (order.quantity ?? 0))),
  );
  const [note, setNote] = useState("");

  const advance = useMutation({
    mutationFn: () =>
      moveOrderToColumn({ data: { orderId: order.id, toColumn: nextColumnKey ?? "" } }),
    onSuccess: () => {
      toast.success(`Avançado para ${nextColumnLabel}`);
      qc.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao avançar"),
  });

  const pointMut = useMutation({
    mutationFn: () =>
      setProductionProgress({
        data: {
          orderId: order.id,
          producedQty: Math.max(0, Math.min(order.quantity, Number(qty) || 0)),
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Apontado: ${r.progress}%`);
      setPointOpen(false);
      setNote("");
      qc.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao apontar"),
  });

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5">
      {/* Atalho: Avançar (só aparece se há próxima coluna) */}
      {nextColumnKey && (
        <button
          title={`Avançar para ${nextColumnLabel}`}
          onClick={(e) => {
            e.preventDefault();
            advance.mutate();
          }}
          disabled={advance.isPending}
          className="p-1 rounded hover:bg-primary/10 text-primary disabled:opacity-50"
        >
          <ArrowRight className="size-3.5" />
        </button>
      )}

      {/* Atalho: Apontar parcial (popover) */}
      <Popover open={pointOpen} onOpenChange={setPointOpen}>
        <PopoverTrigger asChild>
          <button
            title="Apontar produção parcial"
            onClick={(e) => e.preventDefault()}
            className="p-1 rounded hover:bg-amber-500/10 text-amber-600"
          >
            <Gauge className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-64 p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold">Apontamento parcial</div>
          <div className="text-[10px] text-muted-foreground">
            Quantidade já produzida (meta {order.quantity} pç)
          </div>
          <Input
            type="number"
            min={0}
            max={order.quantity}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-8 text-sm"
          />
          <Textarea
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="text-xs"
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={pointMut.isPending}
            onClick={() => pointMut.mutate()}
          >
            {pointMut.isPending ? "Apontando…" : "Apontar"}
          </Button>
        </PopoverContent>
      </Popover>

      {/* Menu completo */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            title="Mais ações"
            onClick={(e) => e.preventDefault()}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
          >
            <MoreVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
            {order.batch_code ?? order.code}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {nextColumnKey && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                advance.mutate();
              }}
            >
              <ArrowRight className="size-3.5" /> Avançar para {nextColumnLabel}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setPointOpen(true);
            }}
          >
            <Gauge className="size-3.5" /> Apontar parcial
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpenHistory(); }}>
            <History className="size-3.5" /> Histórico de passagens
          </DropdownMenuItem>
          {onOpenSheet && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpenSheet(); }}>
              <FileText className="size-3.5" /> Ficha técnica
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {/* Wrappers que abrem seus próprios diálogos */}
          <div className="px-1 py-0.5">
            <ProductionOccurrenceButton
              orderId={order.id}
              orderCode={order.batch_code ?? order.code}
              ownerId={order.owner_id}
            />
          </div>
          <div className="px-1 py-0.5">
            <ProductionOrderCommentsButton
              orderId={order.id}
              orderCode={order.batch_code ?? order.code}
              ownerId={order.owner_id}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
