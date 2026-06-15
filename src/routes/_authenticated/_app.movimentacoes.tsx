import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Plus, ArrowDownToLine, ArrowUpFromLine, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações de Estoque · USE MODA OS" }] }),
  component: MovimentacoesPage,
});

type Mov = {
  id: string; owner_id: string; inventory_item_id: string;
  type: "entrada" | "saida" | "ajuste" | "transferencia";
  quantity: number; reference_kind: string | null; reference_id: string | null;
  notes: string | null; created_at: string;
};
type Item = { id: string; sku: string; name: string; unit: string; balance: number };

function MovimentacoesPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: moves = [], isLoading } = useQuery({
    queryKey: ["stock_movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Mov[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["inventory_items_slim"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("id, sku, name, unit, balance").order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const itemMap = new Map(items.map(i => [i.id, i]));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-primary" /> Movimentações de Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Entradas, saídas e ajustes — saldo atualizado automaticamente.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> Nova movimentação</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2">Quantidade</th>
              <th className="text-left px-3 py-2">Origem</th>
              <th className="text-left px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : moves.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>
            ) : moves.map((m) => {
              const it = itemMap.get(m.inventory_item_id);
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">{typeBadge(m.type)}</td>
                  <td className="px-3 py-2">{it ? <><span className="font-mono text-xs">{it.sku}</span> · {it.name}</> : <span className="text-muted-foreground">—</span>}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.type === "entrada" ? "text-emerald-400" : m.type === "saida" ? "text-destructive" : ""}`}>
                    {m.type === "entrada" ? "+" : m.type === "saida" ? "−" : ""}{Number(m.quantity).toFixed(0)} {it?.unit ?? ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.reference_kind ?? "manual"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-xs">{m.notes ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MovDialog open={open} onOpenChange={setOpen} items={items} userId={user?.id} />
    </div>
  );
}

function typeBadge(t: Mov["type"]) {
  const cfg: Record<string, { label: string; cls: string; Icon: typeof Plus }> = {
    entrada: { label: "Entrada", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", Icon: ArrowDownToLine },
    saida: { label: "Saída", cls: "bg-destructive/20 text-destructive border-destructive/30", Icon: ArrowUpFromLine },
    ajuste: { label: "Ajuste", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", Icon: Settings2 },
    transferencia: { label: "Transferência", cls: "bg-sky-500/20 text-sky-400 border-sky-500/30", Icon: ArrowLeftRight },
  };
  const c = cfg[t];
  const Ic = c.Icon;
  return <Badge variant="outline" className={`${c.cls} gap-1`}><Ic className="size-3" /> {c.label}</Badge>;
}

function MovDialog({ open, onOpenChange, items, userId }: { open: boolean; onOpenChange: (v: boolean) => void; items: Item[]; userId?: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<Mov["type"]>("entrada");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      if (!itemId) throw new Error("Selecione um item");
      if (quantity <= 0 && type !== "ajuste") throw new Error("Quantidade deve ser maior que zero");
      const { error } = await supabase.from("stock_movements").insert({
        owner_id: userId, inventory_item_id: itemId, type, quantity, notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["inventory_items_slim"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Movimentação registrada");
      onOpenChange(false);
      setItemId(""); setQuantity(0); setNotes(""); setType("entrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = items.find(i => i.id === itemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>O saldo do item será atualizado automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as Mov["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="ajuste">Ajuste (saldo absoluto)</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {items.map(i => <SelectItem key={i.id} value={i.id}>{i.sku} · {i.name} (saldo: {Number(i.balance).toFixed(0)} {i.unit})</SelectItem>)}
              </SelectContent>
            </Select>
            {selected && <p className="text-xs text-muted-foreground">Saldo atual: {Number(selected.balance).toFixed(0)} {selected.unit}</p>}
          </div>
          <div className="space-y-2">
            <Label>{type === "ajuste" ? "Novo saldo absoluto" : "Quantidade"}</Label>
            <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
          </div>
          <div className="space-y-2"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
