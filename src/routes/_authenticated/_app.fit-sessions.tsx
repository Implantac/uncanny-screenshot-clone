import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Ruler, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/fit-sessions")({
  head: () => ({ meta: [{ title: "Fit Sessions · USE MODA PLM" }, { name: "description", content: "Provas de piloto estruturadas com comentários por POM." }] }),
  component: Page,
});

type Session = { id: string; session_date: string; iteration: number; status: string; fit_model: string | null; notes: string | null; prototype_id: string | null };
type Comment = { id: string; pom_label: string | null; severity: string; comment: string; resolved: boolean };

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [sf, setSf] = useState({ fit_model: "", notes: "", iteration: 1 });
  const [cf, setCf] = useState({ pom_label: "", severity: "ajuste", comment: "" });

  const sessions = useQuery({
    queryKey: ["fit-sessions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("fit_sessions").select("*").order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const comments = useQuery({
    queryKey: ["fit-comments", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("fit_session_comments").select("*").eq("fit_session_id", selected).order("created_at");
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const addSession = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("fit_sessions").insert({ owner_id: user!.id, ...sf });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sessão criada"); setSf({ fit_model: "", notes: "", iteration: 1 }); qc.invalidateQueries({ queryKey: ["fit-sessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("fit_session_comments").insert({ owner_id: user!.id, fit_session_id: selected, ...cf });
      if (error) throw error;
    },
    onSuccess: () => { setCf({ pom_label: "", severity: "ajuste", comment: "" }); qc.invalidateQueries({ queryKey: ["fit-comments", selected] }); },
  });

  const toggle = useMutation({
    mutationFn: async (c: Comment) => {
      const { error } = await (supabase as any).from("fit_session_comments").update({ resolved: !c.resolved }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fit-comments", selected] }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await (supabase as any).from("fit_sessions").update({ status }).eq("id", selected);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fit-sessions"] }),
  });

  return (
    <div className="p-6 grid lg:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" /><h1 className="text-xl font-bold">Fit Sessions</h1></div>
        <div className="glass rounded-xl p-3 space-y-2">
          <Input placeholder="Modelo (nome)" value={sf.fit_model} onChange={(e) => setSf({ ...sf, fit_model: e.target.value })} />
          <Input type="number" placeholder="Iteração" value={sf.iteration} onChange={(e) => setSf({ ...sf, iteration: Number(e.target.value) })} />
          <Textarea placeholder="Observações" value={sf.notes} onChange={(e) => setSf({ ...sf, notes: e.target.value })} />
          <Button className="w-full" onClick={() => addSession.mutate()}><Plus className="h-4 w-4 mr-1" />Nova sessão</Button>
        </div>
        <div className="space-y-2">
          {sessions.data?.map((s) => (
            <button key={s.id} onClick={() => setSelected(s.id)} className={`w-full text-left glass rounded-lg p-3 hover:bg-accent/30 ${selected === s.id ? "ring-2 ring-primary" : ""}`}>
              <div className="flex justify-between"><span className="font-medium">It. {s.iteration} · {s.fit_model || "—"}</span><Badge variant="outline">{s.status}</Badge></div>
              <p className="text-xs text-muted-foreground">{s.session_date}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {!selected ? <div className="glass rounded-xl p-8 text-center text-muted-foreground">Selecione uma sessão.</div> : (
          <>
            <div className="glass rounded-xl p-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="alterar" /></SelectTrigger>
                <SelectContent>
                  {["aberta", "ajustes", "aprovada", "reprovada"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="glass rounded-xl p-4 space-y-2">
              <h2 className="font-semibold">Novo comentário</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input placeholder="POM (ex: cintura)" value={cf.pom_label} onChange={(e) => setCf({ ...cf, pom_label: e.target.value })} />
                <Select value={cf.severity} onValueChange={(v) => setCf({ ...cf, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["info", "ajuste", "critico"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="md:col-span-2" placeholder="Comentário" value={cf.comment} onChange={(e) => setCf({ ...cf, comment: e.target.value })} />
              </div>
              <Button onClick={() => addComment.mutate()} disabled={!cf.comment}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
            </div>
            <div className="space-y-2">
              {comments.data?.map((c) => (
                <div key={c.id} className={`glass rounded-lg p-3 flex items-start gap-3 ${c.resolved ? "opacity-60" : ""}`}>
                  <Badge variant={c.severity === "critico" ? "destructive" : c.severity === "ajuste" ? "default" : "outline"}>{c.severity}</Badge>
                  <div className="flex-1">
                    {c.pom_label && <p className="text-xs text-muted-foreground">{c.pom_label}</p>}
                    <p className={c.resolved ? "line-through" : ""}>{c.comment}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => toggle.mutate(c)}><CheckCircle2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
