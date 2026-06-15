import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Plus, Trash2, Pencil, Package } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/_app/pedidos-compra")({
  head: () => ({ meta: [{ title: "Pedidos de Compra · USE MODA OS" }] }),
  component: POPage,
});

type Status = "rascunho" | "cotando" | "aprovado" | "recebido" | "cancelado";
type PO = {
  id: string; owner_id: string; supplier_id: string | null; code: string;
  status: Status; expected_date: string | null; total_value: number;
  notes: string | null; created_at: string;
};
type Supplier = { id: string; name: string };
type Item = { id: string; sku: string; name: string; unit: string };
type POItem = { id: string; purchase_order_id: string; inventory_item_id: string | null; description: string | null; quantity: number; unit_price: number; total: number };

const STATUS_CFG: Record<Status, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  cotando: { label: "Cotando", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  aprovado: { label: "Aprovado", cls: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  recebido: { label: "Recebido", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

function POPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PO | null>(null);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as PO[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_slim"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });
  const supMap = new Map(suppliers.map(s => [s.id, s.name]));

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase_orders"] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success(`Status: ${STATUS_CFG[v.status].label}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="size-6 text-primary" /> Pedidos de Compra
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cotações e pedidos. Aprovados geram contas a pagar; recebidos lançam entrada no estoque.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="size-4" /> Novo PO</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Fornecedor</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Previsão</th>
              <th className="text-right px-3 py-2">Valor</th>
              <th className="text-right px-3 py-2 w-32">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum pedido. Crie o primeiro.</td></tr>
            ) : pos.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                <td className="px-3 py-2">{p.supplier_id ? supMap.get(p.supplier_id) ?? "—" : "—"}</td>
                <td className="px-3 py-2">
                  <Select value={p.status} onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v as Status })}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CFG) as Status[]).map(s => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.expected_date ? new Date(p.expected_date).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">R$ {Number(p.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(p); setOpen(true); }} className="size-7 grid place-items-center rounded hover:bg-muted"><Pencil className="size-3.5" /></button>
                    <button onClick={() => confirm("Remover este pedido?") && delMut.mutate(p.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive"><Trash2 className="size-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PODialog open={open} onOpenChange={setOpen} editing={editing} suppliers={suppliers} userId={user?.id} />
    </div>
  );
}

function PODialog({ open, onOpenChange, editing, suppliers, userId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: PO | null; suppliers: Supplier[]; userId?: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", supplier_id: "", status: "rascunho" as Status, expected_date: "", total_value: 0, notes: "" });
  const [items, setItems] = useState<Array<{ id?: string; inventory_item_id: string | null; description: string; quantity: number; unit_price: number }>>([]);

  const { data: invItems = [] } = useQuery({
    queryKey: ["inventory_items_slim_po"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("id, sku, name, unit").order("name");
      if (error) throw error;
      return data as Item[];
    },
    enabled: open,
  });

  const { data: existingItems = [] } = useQuery({
    queryKey: ["purchase_order_items", editing?.id],
    queryFn: async () => {
      if (!editing) return [];
      const { data, error } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", editing.id);
      if (error) throw error;
      return data as POItem[];
    },
    enabled: open && !!editing,
  });

  useEffect(() => {
    if (open && editing) {
      setF({
        code: editing.code, supplier_id: editing.supplier_id ?? "", status: editing.status,
        expected_date: editing.expected_date ?? "", total_value: Number(editing.total_value), notes: editing.notes ?? "",
      });
    } else if (open) {
      setF({ code: `PO-${Date.now().toString().slice(-6)}`, supplier_id: "", status: "rascunho", expected_date: "", total_value: 0, notes: "" });
      setItems([]);
    }
  }, [open, editing]);

  useEffect(() => {
    if (open && editing && existingItems.length) {
      setItems(existingItems.map(it => ({
        id: it.id, inventory_item_id: it.inventory_item_id, description: it.description ?? "",
        quantity: Number(it.quantity), unit_price: Number(it.unit_price),
      })));
    }
  }, [existingItems, open, editing]);

  const totalCalc = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        code: f.code, supplier_id: f.supplier_id || null, status: f.status,
        expected_date: f.expected_date || null, total_value: totalCalc || f.total_value,
        notes: f.notes || null,
      };
      let poId: string;
      if (editing) {
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editing.id);
        if (error) throw error;
        poId = editing.id;
        await supabase.from("purchase_order_items").delete().eq("purchase_order_id", poId);
      } else {
        const { data, error } = await supabase.from("purchase_orders").insert({ ...payload, owner_id: userId }).select("id").single();
        if (error) throw error;
        poId = data.id;
      }
      if (items.length) {
        const rows = items.map(it => ({
          owner_id: userId, purchase_order_id: poId,
          inventory_item_id: it.inventory_item_id, description: it.description || "—",
          quantity: it.quantity, unit_price: it.unit_price,
        }));
        const { error } = await supabase.from("purchase_order_items").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success(editing ? "Pedido atualizado" : "Pedido criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pedido de compra" : "Novo pedido de compra"}</DialogTitle>
          <DialogDescription>Itens, fornecedor e prazo. O total é calculado automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Código</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CFG) as Status[]).map(s => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Previsão</Label><Input type="date" value={f.expected_date} onChange={(e) => setF({ ...f, expected_date: e.target.value })} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Package className="size-4" /> Itens</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { inventory_item_id: null, description: "", quantity: 1, unit_price: 0 }])}>
                <Plus className="size-3" /> Adicionar
              </Button>
            </div>
            {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item. Clique em adicionar.</p>}
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_70px_90px_30px] gap-2 items-center">
                <Select value={it.inventory_item_id ?? "free"} onValueChange={(v) => {
                  const next = [...items];
                  next[idx].inventory_item_id = v === "free" ? null : v;
                  if (v !== "free") {
                    const it2 = invItems.find(i => i.id === v);
                    if (it2) next[idx].description = `${it2.sku} · ${it2.name}`;
                  }
                  setItems(next);
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Item / descrição livre" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">— descrição livre —</SelectItem>
                    {invItems.map(i => <SelectItem key={i.id} value={i.id}>{i.sku} · {i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min="0.01" step="0.01" value={it.quantity} onChange={(e) => { const n = [...items]; n[idx].quantity = Number(e.target.value); setItems(n); }} placeholder="Qtd" />
                <Input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => { const n = [...items]; n[idx].unit_price = Number(e.target.value); setItems(n); }} placeholder="R$" />
                <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="size-8 grid place-items-center rounded hover:bg-destructive/20 text-destructive"><Trash2 className="size-3.5" /></button>
                {it.inventory_item_id === null && (
                  <Input className="col-span-4 h-8" value={it.description} onChange={(e) => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} placeholder="Descrição" />
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-border">
              <Badge variant="outline">Total: R$ {totalCalc.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>
            </div>
          </div>

          <div className="space-y-2"><Label>Observações</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
