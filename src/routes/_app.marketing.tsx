import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { Megaphone, Calendar, Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing · USE MODA OS" },
      { name: "description", content: "Campanhas e performance de mídia." },
    ],
  }),
  component: Marketing,
});

type CStatus = "programada" | "ativa" | "pausada" | "concluida";
type Campaign = {
  id: string; owner_id: string; name: string; channel: string | null;
  start_date: string | null; end_date: string | null;
  investment: number; roas: number; status: CStatus; notes: string | null;
};

const STATUS_LABEL: Record<CStatus, string> = {
  programada: "Programada", ativa: "Ativa", pausada: "Pausada", concluida: "Concluída",
};
const STATUS_STYLE: Record<CStatus, string> = {
  programada: "bg-sky-500/15 text-sky-400",
  ativa: "bg-emerald-500/15 text-emerald-400",
  pausada: "bg-amber-500/15 text-amber-400",
  concluida: "bg-muted text-muted-foreground",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function Marketing() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("marketing_campaigns", ["marketing_campaigns"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["marketing_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing_campaigns"] }); toast.success("Campanha removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ativas = rows.filter((c) => c.status === "ativa").length;
  const invTotal = rows.reduce((a, b) => a + Number(b.investment), 0);
  const roasAvg = rows.length ? rows.reduce((a, b) => a + Number(b.roas), 0) / rows.length : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Megaphone className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
            <p className="text-sm text-muted-foreground">Campanhas e calendário editorial</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="size-4" /> Nova campanha
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Campanhas ativas</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{ativas}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Investimento total</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{brl(invTotal)}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">ROAS médio</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{roasAvg.toFixed(1)}x</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Sem campanhas</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie a primeira campanha.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>Nova campanha</Button>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border text-sm font-semibold inline-flex items-center gap-2"><Calendar className="size-4" /> Campanhas</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Campanha</th>
                  <th className="text-left font-medium px-5 py-2.5">Canal</th>
                  <th className="text-left font-medium px-5 py-2.5">Período</th>
                  <th className="text-right font-medium px-5 py-2.5">Investimento</th>
                  <th className="text-right font-medium px-5 py-2.5">ROAS</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const mine = c.owner_id === user?.id;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.channel || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">{fmt(c.start_date)} → {fmt(c.end_date)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{brl(Number(c.investment))}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">{Number(c.roas) > 0 ? `${Number(c.roas).toFixed(1)}x` : "—"}</td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td className="px-5 py-3 text-right">
                        {mine && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditing(c); setOpen(true); }} className="size-7 grid place-items-center rounded hover:bg-muted">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => confirm("Remover esta campanha?") && deleteMut.mutate(c.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CampaignDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function CampaignDialog({ open, onOpenChange, editing, userId }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Campaign | null; userId?: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [investment, setInvestment] = useState("0");
  const [roas, setRoas] = useState("0");
  const [status, setStatus] = useState<CStatus>("programada");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && editing) {
      setName(editing.name); setChannel(editing.channel || "");
      setStartDate(editing.start_date?.slice(0, 10) || "");
      setEndDate(editing.end_date?.slice(0, 10) || "");
      setInvestment(String(editing.investment)); setRoas(String(editing.roas));
      setStatus(editing.status); setNotes(editing.notes || "");
    } else if (open) {
      setName(""); setChannel(""); setStartDate(""); setEndDate("");
      setInvestment("0"); setRoas("0"); setStatus("programada"); setNotes("");
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        name, channel: channel || null,
        start_date: startDate || null, end_date: endDate || null,
        investment: Number(investment), roas: Number(roas),
        status, notes: notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("marketing_campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_campaigns").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_campaigns"] });
      toast.success(editing ? "Campanha atualizada" : "Campanha criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          <DialogDescription>Planejamento e performance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Canal</Label><Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Meta + Google" /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as CStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Investimento (R$)</Label><Input type="number" step="0.01" value={investment} onChange={(e) => setInvestment(e.target.value)} /></div>
            <div className="space-y-2"><Label>ROAS</Label><Input type="number" step="0.1" value={roas} onChange={(e) => setRoas(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
