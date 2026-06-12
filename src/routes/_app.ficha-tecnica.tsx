import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Pencil } from "lucide-react";
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

export const Route = createFileRoute("/_app/ficha-tecnica")({
  head: () => ({ meta: [{ title: "Ficha Técnica · USE MODA OS" }, { name: "description", content: "Tech packs versionados." }] }),
  component: FichaPage,
});

type Status = "rascunho" | "em_revisao" | "aprovada";
type Sheet = {
  id: string; owner_id: string; product_id: string | null;
  code: string; version: string; status: Status; content: string | null; created_at: string;
};
type Ref = { id: string; name: string };

const LABEL: Record<Status, string> = { rascunho: "Rascunho", em_revisao: "Em revisão", aprovada: "Aprovada" };
const COLOR: Record<Status, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_revisao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  aprovada: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function FichaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sheet | null>(null);
  const [form, setForm] = useState({ code: "", product_id: "", version: "v1.0", status: "rascunho" as Status, content: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["tech_sheets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tech_sheets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sheet[];
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

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!form.code.trim()) throw new Error("Código obrigatório");
      const payload = {
        owner_id: user.id,
        code: form.code.trim(),
        product_id: form.product_id || null,
        version: form.version.trim() || "v1.0",
        status: form.status,
        content: form.content.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("tech_sheets").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tech_sheets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success(editing ? "Ficha atualizada" : "Ficha criada");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_sheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tech_sheets"] }); toast.success("Removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setOpen(false); setEditing(null);
    setForm({ code: "", product_id: "", version: "v1.0", status: "rascunho", content: "" });
  }

  function openEdit(s: Sheet) {
    setEditing(s);
    setForm({ code: s.code, product_id: s.product_id ?? "", version: s.version, status: s.status, content: s.content ?? "" });
    setOpen(true);
  }

  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center"><FileText className="size-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">Ficha Técnica</h1>
            <p className="text-sm text-muted-foreground">Tech packs versionados</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />Nova ficha</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Versão</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-3">{productName(s.product_id)}</td>
                  <td className="px-4 py-3">{s.version}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={COLOR[s.status]}>{LABEL[s.status]}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {user?.id === s.owner_id && (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="size-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma ficha ainda</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar ficha" : "Nova ficha"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="FT-001" /></div>
              <div><Label>Versão</Label><Input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="v1.0" /></div>
            </div>
            <div>
              <Label>Produto</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Conteúdo</Label><Textarea rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Materiais, medidas, acabamentos…" /></div>
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
