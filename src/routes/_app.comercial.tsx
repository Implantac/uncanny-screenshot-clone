import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Trash2, Pencil, Download, FileText } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { exportToPdf } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/comercial")({
  head: () => ({ meta: [{ title: "Comercial · USE MODA OS" }, { name: "description", content: "Pedidos B2B e carteira." }] }),
  component: Comercial,
});

type Status = "rascunho" | "aprovado" | "em_producao" | "faturado" | "cancelado";
type Order = {
  id: string; owner_id: string; code: string; customer_name: string; representative: string | null;
  total_value: number; status: Status; order_date: string; notes: string | null; created_at: string;
};

const LABEL: Record<Status, string> = {
  rascunho: "Rascunho", aprovado: "Aprovado", em_producao: "Em produção", faturado: "Faturado", cancelado: "Cancelado",
};
const COLOR: Record<Status, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aprovado: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  em_producao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  faturado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelado: "bg-destructive/20 text-destructive border-destructive/30",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Comercial() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    code: "", customer_name: "", representative: "", total_value: 0,
    status: "rascunho" as Status, order_date: today, notes: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["b2b_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("b2b_orders").select("*").order("order_date", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!form.code.trim()) throw new Error("Código obrigatório");
      if (!form.customer_name.trim()) throw new Error("Cliente obrigatório");
      const payload = {
        owner_id: user.id,
        code: form.code.trim(),
        customer_name: form.customer_name.trim(),
        representative: form.representative.trim() || null,
        total_value: Number(form.total_value) || 0,
        status: form.status,
        order_date: form.order_date || today,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("b2b_orders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("b2b_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b_orders"] });
      toast.success(editing ? "Pedido atualizado" : "Pedido criado");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("b2b_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["b2b_orders"] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setOpen(false); setEditing(null);
    setForm({ code: "", customer_name: "", representative: "", total_value: 0, status: "rascunho", order_date: today, notes: "" });
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      code: o.code, customer_name: o.customer_name, representative: o.representative ?? "",
      total_value: o.total_value, status: o.status, order_date: o.order_date, notes: o.notes ?? "",
    });
    setOpen(true);
  }

  const total = items.reduce((acc, o) => acc + Number(o.total_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center"><Store className="size-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">Comercial / B2B</h1>
            <p className="text-sm text-muted-foreground">Pedidos · carteira total {brl(total)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv("pedidos-b2b", items.map((o) => ({ ...o, status: LABEL[o.status] })), [
            { key: "code", label: "Código" }, { key: "customer_name", label: "Cliente" },
            { key: "representative", label: "Representante" }, { key: "order_date", label: "Data" },
            { key: "status", label: "Status" }, { key: "total_value", label: "Valor" }, { key: "notes", label: "Observações" },
          ])} disabled={!items.length}><Download className="size-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={() => exportToPdf("pedidos-b2b", "Pedidos B2B", items.map((o) => ({ ...o, status: LABEL[o.status] })), [
            { key: "code", label: "Código" }, { key: "customer_name", label: "Cliente" },
            { key: "representative", label: "Representante" }, { key: "order_date", label: "Data" },
            { key: "status", label: "Status" }, { key: "total_value", label: "Valor" },
          ])} disabled={!items.length}><FileText className="size-4 mr-2" />PDF</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />Novo pedido</Button>
        </div>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Pedido</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Rep.</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                  <td className="px-4 py-3">{o.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.representative ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{brl(Number(o.total_value))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.order_date}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={COLOR[o.status]}>{LABEL[o.status]}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {user?.id === o.owner_id && (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(o)}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)}><Trash2 className="size-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum pedido ainda</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar pedido" : "Novo pedido"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="#5821" /></div>
              <div><Label>Data</Label><Input type="date" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} /></div>
            </div>
            <div><Label>Cliente *</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Representante</Label><Input value={form.representative} onChange={e => setForm({ ...form, representative: e.target.value })} /></div>
              <div><Label>Valor total</Label><Input type="number" step="0.01" value={form.total_value} onChange={e => setForm({ ...form, total_value: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
