import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Factory, Plus, Trash2, Pencil, Download, FileText } from "lucide-react";
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

export const Route = createFileRoute("/_app/pcp")({
  head: () => ({ meta: [{ title: "PCP · USE MODA OS" }, { name: "description", content: "Ordens de produção." }] }),
  component: PCP,
});

type Status = "aguardando" | "em_producao" | "concluida" | "atrasada" | "cancelada";
type Order = {
  id: string; owner_id: string; product_id: string | null; supplier_id: string | null;
  code: string; quantity: number; progress: number; due_date: string | null;
  status: Status; notes: string | null; created_at: string;
};
type Ref = { id: string; name: string };

const LABEL: Record<Status, string> = {
  aguardando: "Aguardando", em_producao: "Em produção", concluida: "Concluída", atrasada: "Atrasada", cancelada: "Cancelada",
};
const COLOR: Record<Status, string> = {
  aguardando: "bg-muted text-muted-foreground",
  em_producao: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  concluida: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  atrasada: "bg-destructive/20 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground",
};

function PCP() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState({
    code: "", product_id: "", supplier_id: "", quantity: 0, progress: 0,
    due_date: "", status: "aguardando" as Status, notes: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name").order("name");
      if (error) throw error;
      return data as Ref[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
      if (error) throw error;
      return data as Ref[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!form.code.trim()) throw new Error("Código obrigatório");
      const payload = {
        owner_id: user.id,
        code: form.code.trim(),
        product_id: form.product_id || null,
        supplier_id: form.supplier_id || null,
        quantity: Number(form.quantity) || 0,
        progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
        due_date: form.due_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("production_orders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("production_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success(editing ? "Ordem atualizada" : "Ordem criada");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production_orders"] }); toast.success("Removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setOpen(false); setEditing(null);
    setForm({ code: "", product_id: "", supplier_id: "", quantity: 0, progress: 0, due_date: "", status: "aguardando", notes: "" });
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      code: o.code, product_id: o.product_id ?? "", supplier_id: o.supplier_id ?? "",
      quantity: o.quantity, progress: o.progress, due_date: o.due_date ?? "",
      status: o.status, notes: o.notes ?? "",
    });
    setOpen(true);
  }

  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center"><Factory className="size-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">PCP & Produção</h1>
            <p className="text-sm text-muted-foreground">Ordens, progresso e prazos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv("ordens-producao", items.map((o) => ({ ...o, status: LABEL[o.status] })), [
            { key: "code", label: "Código" }, { key: "quantity", label: "Quantidade" },
            { key: "progress", label: "Progresso %" }, { key: "due_date", label: "Prazo" },
            { key: "status", label: "Status" }, { key: "notes", label: "Observações" },
          ])} disabled={!items.length}><Download className="size-4 mr-2" />Exportar CSV</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />Nova OP</Button>
        </div>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">OP</th>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Facção</th>
                <th className="text-right px-4 py-3">Qtd</th>
                <th className="text-left px-4 py-3">Progresso</th>
                <th className="text-left px-4 py-3">Prazo</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                  <td className="px-4 py-3">{productName(o.product_id)}</td>
                  <td className="px-4 py-3">{supplierName(o.supplier_id)}</td>
                  <td className="px-4 py-3 text-right">{o.quantity}</td>
                  <td className="px-4 py-3 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{o.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.due_date ?? "—"}</td>
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
              {items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma ordem ainda</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar OP" : "Nova OP"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="OP-001" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Produto</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Facção</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              <div><Label>Progresso (%)</Label><Input type="number" min={0} max={100} value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })} /></div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
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
