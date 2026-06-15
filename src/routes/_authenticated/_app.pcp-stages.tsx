import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KanbanSquare, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/pcp-stages")({
  head: () => ({
    meta: [
      { title: "Etapas do PCP · USE MODA PLM" },
      { name: "description", content: "Configure as etapas do seu fluxo de produção." },
    ],
  }),
  component: PcpStagesPage,
});

type Stage = {
  id: string;
  owner_id: string;
  key: string;
  label: string;
  position: number;
  color: string | null;
  active: boolean;
};

const DEFAULT_SEEDS = [
  { key: "cad", label: "Modelagem", color: "#a78bfa" },
  { key: "corte", label: "Corte", color: "#f59e0b" },
  { key: "costura", label: "Costura", color: "#22d3ee" },
  { key: "acabamento", label: "Acabamento", color: "#34d399" },
  { key: "expedicao", label: "Expedição", color: "#60a5fa" },
];

function PcpStagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["pcp-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pcp_stages")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Stage[];
    },
  });

  const seedMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      const rows = DEFAULT_SEEDS.map((s, i) => ({ ...s, position: i, owner_id: user.id, active: true }));
      const { error } = await supabase.from("pcp_stages").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pcp-stages"] }); toast.success("Etapas padrão criadas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: -1 | 1 }) => {
      const idx = stages.findIndex((s) => s.id === id);
      const swap = stages[idx + delta];
      if (!swap) return;
      const a = stages[idx];
      await supabase.from("pcp_stages").update({ position: swap.position }).eq("id", a.id);
      await supabase.from("pcp_stages").update({ position: a.position }).eq("id", swap.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pcp-stages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (s: Stage) => {
      const { error } = await supabase.from("pcp_stages").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pcp-stages"] }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pcp_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pcp-stages"] }); toast.success("Etapa removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">PCP · Configuração</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <KanbanSquare className="size-6 text-primary" /> Etapas do PCP
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Defina os estágios que aparecem no Kanban e na rastreabilidade.</p>
        </div>
        <div className="flex gap-2">
          {stages.length === 0 && (
            <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              Criar etapas padrão
            </Button>
          )}
          <Button className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4" /> Nova etapa
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : stages.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <KanbanSquare className="size-10 text-primary mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Nenhuma etapa configurada</h2>
          <p className="text-sm text-muted-foreground mb-4">Use as etapas padrão ou crie do zero o fluxo da sua fábrica.</p>
        </div>
      ) : (
        <div className="glass rounded-xl p-3 sm:p-4 space-y-2">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
              <div className="size-6 rounded border border-border" style={{ background: s.color ?? "transparent" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.label}</span>
                  <Badge variant="outline" className="text-[10px]">{s.key}</Badge>
                  {!s.active && <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">inativa</Badge>}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">Posição #{s.position}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="size-8" disabled={i === 0} onClick={() => moveMut.mutate({ id: s.id, delta: -1 })}><ArrowUp className="size-3.5" /></Button>
                <Button size="icon" variant="outline" className="size-8" disabled={i === stages.length - 1} onClick={() => moveMut.mutate({ id: s.id, delta: 1 })}><ArrowDown className="size-3.5" /></Button>
                <Button size="icon" variant="outline" className="size-8" onClick={() => toggleMut.mutate(s)}>{s.active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
                <Button size="icon" variant="outline" className="size-8" onClick={() => { setEditing(s); setOpen(true); }}>✎</Button>
                <Button size="icon" variant="outline" className="size-8 text-destructive" onClick={() => { if (confirm("Remover etapa?")) delMut.mutate(s.id); }}><Trash2 className="size-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StageDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} nextPosition={stages.length} />
    </div>
  );
}

function StageDialog({ open, onOpenChange, editing, userId, nextPosition }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Stage | null; userId?: string; nextPosition: number }) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#a78bfa");

  useMemo(() => {
    if (!open) return;
    if (editing) { setKey(editing.key); setLabel(editing.label); setColor(editing.color ?? "#a78bfa"); }
    else { setKey(""); setLabel(""); setColor("#a78bfa"); }
  }, [open, editing?.id]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const k = key.trim().toLowerCase().replace(/\s+/g, "_");
      if (!k || !label.trim()) throw new Error("Preencha chave e rótulo");
      if (editing) {
        const { error } = await supabase.from("pcp_stages").update({ key: k, label, color }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pcp_stages").insert({ owner_id: userId, key: k, label, color, position: nextPosition, active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pcp-stages"] }); toast.success(editing ? "Etapa atualizada" : "Etapa criada"); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar etapa" : "Nova etapa"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Chave</Label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="costura" required /></div>
            <div className="space-y-2"><Label>Rótulo</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Costura" required /></div>
          </div>
          <div className="space-y-2"><Label>Cor</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-24 p-1" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
