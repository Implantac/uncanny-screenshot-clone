import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Ruler, CheckCircle2, Image as ImageIcon, MessageSquare, CheckCheck, AlertTriangle, Columns2, X } from "lucide-react";
import { toast } from "sonner";
import { StorageUploader } from "@/components/storage-uploader";
import { PageHeader } from "@/components/ui/page-header";
import { ImageLightbox } from "@/components/ui/image-lightbox";

export const Route = createFileRoute("/_authenticated/_app/fit-sessions")({
  head: () => ({
    meta: [
      { title: "Fit Sessions · USE MODA PLM" },
      { name: "description", content: "Histórico de provas com fotos, comentários técnicos e status de aprovação." },
    ],
  }),
  component: Page,
});

type Session = {
  id: string;
  session_date: string;
  iteration: number;
  status: string;
  fit_model: string | null;
  notes: string | null;
  prototype_id: string | null;
};
type Comment = {
  id: string;
  pom_label: string | null;
  severity: string;
  comment: string;
  resolved: boolean;
  image_url: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  aberta:    { label: "Em avaliação",         color: "bg-muted text-foreground",                icon: MessageSquare },
  ajustes:   { label: "Em ajuste",            color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  aprovada:  { label: "Aprovada p/ produção", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCheck },
  reprovada: { label: "Reprovada",            color: "bg-red-500/15 text-red-600 border-red-500/30", icon: AlertTriangle },
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [sf, setSf] = useState({ fit_model: "", notes: "", iteration: 1 });
  const [cf, setCf] = useState<{ pom_label: string; severity: string; comment: string; image_url: string | null }>({
    pom_label: "",
    severity: "ajuste",
    comment: "",
    image_url: null,
  });

  const sessions = useQuery({
    queryKey: ["fit-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fit_sessions")
        .select("*")
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const comments = useQuery({
    queryKey: ["fit-comments", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fit_session_comments")
        .select("*")
        .eq("fit_session_id", selected!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const currentSession = useMemo(
    () => sessions.data?.find((s) => s.id === selected) ?? null,
    [sessions.data, selected],
  );

  const addSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fit_sessions")
        .insert({ owner_id: user!.id, ...sf });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sessão criada");
      setSf({ fit_model: "", notes: "", iteration: 1 });
      qc.invalidateQueries({ queryKey: ["fit-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fit_session_comments")
        .insert({ owner_id: user!.id, fit_session_id: selected!, ...cf });
      if (error) throw error;
    },
    onSuccess: () => {
      setCf({ pom_label: "", severity: "ajuste", comment: "", image_url: null });
      qc.invalidateQueries({ queryKey: ["fit-comments", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (c: Comment) => {
      const { error } = await supabase
        .from("fit_session_comments")
        .update({ resolved: !c.resolved })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fit-comments", selected] }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("fit_sessions")
        .update({ status })
        .eq("id", selected!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["fit-sessions"] });
    },
  });

  const photos = useMemo(
    () => (comments.data ?? []).filter((c) => !!c.image_url).map((c) => c.image_url!),
    [comments.data],
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        eyebrow="Qualidade"
        title="Histórico de Provas"
        description="Fit sessions com fotos, comentários técnicos e aprovação de peça piloto."
      />
      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-4">
        <div className="glass rounded-xl p-3 space-y-2">
          <Input
            placeholder="Modelo (nome)"
            value={sf.fit_model}
            onChange={(e) => setSf({ ...sf, fit_model: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Iteração"
            value={sf.iteration}
            onChange={(e) => setSf({ ...sf, iteration: Number(e.target.value) })}
          />
          <Textarea
            placeholder="Observações"
            value={sf.notes}
            onChange={(e) => setSf({ ...sf, notes: e.target.value })}
          />
          <Button className="w-full" onClick={() => addSession.mutate()}>
            <Plus className="h-4 w-4 mr-1" />
            Nova prova
          </Button>
        </div>
        <div className="space-y-2">
          {sessions.data?.map((s) => {
            const meta = STATUS_META[s.status] ?? STATUS_META.aberta;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full text-left glass rounded-lg p-3 hover:bg-accent/30 transition ${selected === s.id ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    It. {s.iteration} · {s.fit_model || "—"}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                    {meta.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(s.session_date).toLocaleDateString("pt-BR")}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {!selected || !currentSession ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">
            Selecione uma prova ao lado ou crie uma nova.
          </div>
        ) : (
          <>
            {/* Header com status seletor destacado */}
            <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Prova · Iteração {currentSession.iteration}
                </div>
                <div className="font-semibold text-lg">
                  {currentSession.fit_model || "Modelo não informado"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(currentSession.session_date).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Definir status:</span>
                <Select
                  value={currentSession.status}
                  onValueChange={(v) => updateStatus.mutate(v)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Galeria de fotos coletadas */}
            {photos.length > 0 && (
              <div className="glass rounded-xl p-4">
                <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4 text-primary" /> Fotos da prova ({photos.length})
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {photos.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary/60 transition"
                    >
                      <img src={url} alt="Foto da prova" className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Composer estilo chat */}
            <div className="glass rounded-xl p-4 space-y-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Novo apontamento
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input
                  placeholder="POM (ex: cintura)"
                  value={cf.pom_label}
                  onChange={(e) => setCf({ ...cf, pom_label: e.target.value })}
                />
                <Select value={cf.severity} onValueChange={(v) => setCf({ ...cf, severity: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["info", "ajuste", "critico"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  className="md:col-span-4 min-h-[70px]"
                  placeholder="Escreva o comentário técnico…"
                  value={cf.comment}
                  onChange={(e) => setCf({ ...cf, comment: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StorageUploader
                  bucket="fit-photos"
                  kind="image"
                  value={cf.image_url}
                  onChange={(url) => setCf({ ...cf, image_url: url })}
                  label={cf.image_url ? "Trocar foto" : "Anexar foto"}
                />
                <Button onClick={() => addComment.mutate()} disabled={!cf.comment || addComment.isPending}>
                  <Plus className="h-4 w-4 mr-1" />
                  Publicar
                </Button>
              </div>
            </div>

            {/* Timeline / chat */}
            <div className="space-y-3">
              {(comments.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Sem apontamentos nesta prova ainda.
                </div>
              )}
              {(comments.data ?? []).map((c) => (
                <div
                  key={c.id}
                  className={`glass rounded-xl p-3 flex gap-3 ${c.resolved ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Badge
                      variant={
                        c.severity === "critico"
                          ? "destructive"
                          : c.severity === "ajuste"
                            ? "default"
                            : "outline"
                      }
                      className="text-[10px]"
                    >
                      {c.severity}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {c.pom_label ? <b className="text-foreground">{c.pom_label}</b> : "Comentário geral"}
                      </span>
                      <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className={`text-sm ${c.resolved ? "line-through" : ""}`}>{c.comment}</p>
                    {c.image_url && (
                      <a href={c.image_url} target="_blank" rel="noreferrer" className="inline-block">
                        <img
                          src={c.image_url}
                          alt="Anexo"
                          className="mt-1 max-h-48 rounded-md border border-border object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={c.resolved ? "Reabrir comentário" : "Resolver comentário"}
                    onClick={() => toggle.mutate(c)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
