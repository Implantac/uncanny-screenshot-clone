import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Scissors, Plus, Trash2, Pencil, Search, X, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/prototipos")({
  head: () => ({ meta: [{ title: "Protótipos · USE MODA OS" }, { name: "description", content: "Ciclo de protótipos, provas e aprovações." }] }),
  component: Prototipos,
});

type Stage = "solicitado" | "em_confeccao" | "em_prova" | "aprovado" | "reprovado";
type Prototype = {
  id: string; owner_id: string; product_id: string | null; supplier_id: string | null;
  code: string; stage: Stage; due_date: string | null; notes: string | null; created_at: string;
};
type Ref = { id: string; name: string };

const STAGE_LABEL: Record<Stage, string> = {
  solicitado: "Solicitado", em_confeccao: "Em confecção", em_prova: "Em prova", aprovado: "Aprovado", reprovado: "Reprovado",
};
const STAGE_COLOR: Record<Stage, string> = {
  solicitado: "bg-muted text-muted-foreground",
  em_confeccao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  em_prova: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  aprovado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  reprovado: "bg-destructive/20 text-destructive border-destructive/30",
};

function Prototipos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("prototypes", ["prototypes"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prototype | null>(null);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [form, setForm] = useState({ code: "", product_id: "", supplier_id: "", stage: "solicitado" as Stage, due_date: "", notes: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["prototypes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prototypes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prototype[];
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
        stage: form.stage,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("prototypes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prototypes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      toast.success(editing ? "Protótipo atualizado" : "Protótipo criado");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prototypes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prototypes"] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setOpen(false); setEditing(null);
    setForm({ code: "", product_id: "", supplier_id: "", stage: "solicitado", due_date: "", notes: "" });
  }

  function openEdit(p: Prototype) {
    setEditing(p);
    setForm({
      code: p.code, product_id: p.product_id ?? "", supplier_id: p.supplier_id ?? "",
      stage: p.stage, due_date: p.due_date ?? "", notes: p.notes ?? "",
    });
    setOpen(true);
  }

  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center"><Scissors className="size-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">Protótipos</h1>
            <p className="text-sm text-muted-foreground">Solicitações, provas e aprovações</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />Nova solicitação</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(STAGE_LABEL) as Stage[]).map(st => {
              const n = items.filter(i => i.stage === st).length;
              const pct = items.length ? Math.round((n / items.length) * 100) : 0;
              return (
                <div key={st} className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
                  <Badge variant="outline" className={STAGE_COLOR[st]}>{STAGE_LABEL[st]}</Badge>
                  <div className="text-2xl font-semibold">{n}</div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{pct}% do funil</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {(Object.keys(STAGE_LABEL) as Stage[]).map(st => {
              const col = items.filter(i => i.stage === st);
              return (
                <div key={st} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2 min-h-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{STAGE_LABEL[st]}</span>
                    <span className="text-xs text-muted-foreground">{col.length}</span>
                  </div>
                  {col.map(p => (
                    <button
                      key={p.id}
                      onClick={() => user?.id === p.owner_id && openEdit(p)}
                      className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/30 transition p-3 space-y-1"
                    >
                      <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                      <div className="text-sm font-medium truncate">{productName(p.product_id)}</div>
                      <div className="text-xs text-muted-foreground truncate">{supplierName(p.supplier_id)}</div>
                      {p.due_date && <div className="text-[10px] text-muted-foreground">Prazo: {p.due_date}</div>}
                    </button>
                  ))}
                  {!col.length && <p className="text-xs text-muted-foreground/60 text-center py-6">vazio</p>}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-left px-4 py-3">Facção</th>
                  <th className="text-left px-4 py-3">Etapa</th>
                  <th className="text-left px-4 py-3">Prazo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-3">{productName(p.product_id)}</td>
                    <td className="px-4 py-3">{supplierName(p.supplier_id)}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={STAGE_COLOR[p.stage]}>{STAGE_LABEL[p.stage]}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.due_date ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {user?.id === p.owner_id && (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="size-4" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum protótipo ainda</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar protótipo" : "Novo protótipo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PT-001" /></div>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Etapa</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STAGE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
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
