import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Calendar, Sparkles, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/colecoes")({
  head: () => ({
    meta: [
      { title: "Coleções · USE MODA OS" },
      { name: "description", content: "Gestão de coleções de moda." },
    ],
  }),
  component: ColecoesPage,
});

type Collection = {
  id: string;
  owner_id: string;
  name: string;
  season: string;
  year: number;
  status: "briefing" | "design" | "desenvolvimento" | "producao" | "entregue";
  description: string | null;
  palette: string[];
  launch_date: string | null;
  progress: number;
  created_at: string;
};

const STATUS_LABELS: Record<Collection["status"], string> = {
  briefing: "Briefing",
  design: "Design",
  desenvolvimento: "Desenvolvimento",
  producao: "Produção",
  entregue: "Entregue",
};

const STATUS_COLORS: Record<Collection["status"], string> = {
  briefing: "bg-muted text-muted-foreground",
  design: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  desenvolvimento: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  producao: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  entregue: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function ColecoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Collection[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Coleção removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Collection) {
    setEditing(c);
    setOpen(true);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="size-6 text-primary" /> Coleções
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todas as suas coleções — do briefing à entrega.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Nova Coleção
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : collections.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Nenhuma coleção ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie sua primeira coleção para começar.</p>
          <Button onClick={openCreate}>Criar coleção</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {collections.map((c) => (
            <div key={c.id} className="glass rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.season} {c.year}</p>
                </div>
                <Badge variant="outline" className={STATUS_COLORS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
              </div>
              {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{c.progress}%</span>
                </div>
                <Progress value={c.progress} className="h-1.5" />
              </div>
              {c.palette.length > 0 && (
                <div className="flex gap-1">
                  {c.palette.slice(0, 6).map((color, i) => (
                    <div key={i} className="size-5 rounded-full border border-border" style={{ background: color }} />
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {c.launch_date ? new Date(c.launch_date).toLocaleDateString("pt-BR") : "Sem data"}
                </span>
                {c.owner_id === user?.id && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="size-7 grid place-items-center rounded hover:bg-muted">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => confirm("Remover esta coleção?") && deleteMut.mutate(c.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CollectionDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function CollectionDialog({
  open,
  onOpenChange,
  editing,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Collection | null;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [season, setSeason] = useState("Verão");
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [status, setStatus] = useState<Collection["status"]>("briefing");
  const [description, setDescription] = useState("");
  const [paletteStr, setPaletteStr] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [progress, setProgress] = useState(0);

  // reset on open
  useState(() => {});
  if (open && editing && name === "" && editing.name !== "") {
    setName(editing.name);
    setSeason(editing.season);
    setYear(editing.year);
    setStatus(editing.status);
    setDescription(editing.description || "");
    setPaletteStr(editing.palette.join(", "));
    setLaunchDate(editing.launch_date || "");
    setProgress(editing.progress);
  }

  function resetForm() {
    setName("");
    setSeason("Verão");
    setYear(new Date().getFullYear() + 1);
    setStatus("briefing");
    setDescription("");
    setPaletteStr("");
    setLaunchDate("");
    setProgress(0);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        name,
        season,
        year,
        status,
        description: description || null,
        palette: paletteStr.split(",").map((s) => s.trim()).filter(Boolean),
        launch_date: launchDate || null,
        progress,
      };
      if (editing) {
        const { error } = await supabase.from("collections").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("collections").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success(editing ? "Coleção atualizada" : "Coleção criada");
      onOpenChange(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar coleção" : "Nova coleção"}</DialogTitle>
          <DialogDescription>Defina os detalhes da coleção.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Resort 2026" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Temporada</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Verão", "Inverno", "Resort", "Pré-Outono", "Pré-Verão", "Cápsula"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Collection["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Conceito, inspirações…" />
          </div>
          <div className="space-y-2">
            <Label>Paleta (cores separadas por vírgula)</Label>
            <Input value={paletteStr} onChange={(e) => setPaletteStr(e.target.value)} placeholder="#e8d5b7, #4a5d3a, #f5f1e8" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de lançamento</Label>
              <Input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Progresso ({progress}%)</Label>
              <Input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
