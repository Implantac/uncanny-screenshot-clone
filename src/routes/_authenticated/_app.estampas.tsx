import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StorageUploader } from "@/components/storage-uploader";
import { Palette, Plus, CheckCircle2, XCircle, AlertTriangle, Send, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/estampas")({
  head: () => ({
    meta: [
      { title: "Aprovação de Estampas & Silk · USE MODA PLM" },
      { name: "description", content: "Arte final → prova de cor → liberação para fornecedor." },
    ],
  }),
  component: EstampasPage,
});

const TECHNIQUES = [
  { v: "silk", l: "Silk" },
  { v: "estampa_digital", l: "Estampa digital" },
  { v: "sublimacao", l: "Sublimação" },
  { v: "dtf", l: "DTF" },
  { v: "bordado", l: "Bordado" },
  { v: "transfer", l: "Transfer" },
] as const;

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  aguardando_prova: { label: "Aguardando prova", variant: "secondary" },
  em_prova: { label: "Em prova", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
  liberada_producao: { label: "Liberada p/ produção", variant: "default" },
};

type Artwork = {
  id: string;
  name: string;
  technique: string;
  artwork_url: string | null;
  colors: string[];
  status: keyof typeof STATUS_META;
  position_notes: string | null;
  size_notes: string | null;
  released_at: string | null;
  product_id: string | null;
  collection_id: string | null;
  created_at: string;
};

function EstampasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("todas");
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [newForm, setNewForm] = useState({ name: "", technique: "silk", position_notes: "", size_notes: "" });

  const { data: artworks = [], isLoading } = useQuery({
    queryKey: ["print-artworks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_artworks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Artwork[];
    },
  });

  const filtered = useMemo(() => {
    if (tab === "todas") return artworks;
    if (tab === "pendentes") return artworks.filter((a) => ["rascunho", "aguardando_prova", "em_prova"].includes(a.status));
    if (tab === "aprovadas") return artworks.filter((a) => ["aprovada", "liberada_producao"].includes(a.status));
    if (tab === "rejeitadas") return artworks.filter((a) => a.status === "rejeitada");
    return artworks;
  }, [artworks, tab]);

  const createArtwork = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      if (!newForm.name.trim()) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("print_artworks").insert({
        owner_id: user.id,
        name: newForm.name.trim(),
        technique: newForm.technique as any,
        position_notes: newForm.position_notes.trim() || null,
        size_notes: newForm.size_notes.trim() || null,
        status: "rascunho",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arte criada");
      setOpenNew(false);
      setNewForm({ name: "", technique: "silk", position_notes: "", size_notes: "" });
      qc.invalidateQueries({ queryKey: ["print-artworks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Desenvolvimento"
        title={<span className="flex items-center gap-2"><Palette className="size-5" /> Aprovação de Estampas & Silk</span>}
        description="Arte final → prova de cor → liberação para o fornecedor. Rastreia rounds e responsáveis."
        actions={
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-1" /> Nova arte</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova arte</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Nome</label>
                  <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Ex: Silk Frente Camiseta SS26" />
                </div>
                <div>
                  <label className="text-sm">Técnica</label>
                  <Select value={newForm.technique} onValueChange={(v) => setNewForm({ ...newForm, technique: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TECHNIQUES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">Posição na peça</label>
                  <Input value={newForm.position_notes} onChange={(e) => setNewForm({ ...newForm, position_notes: e.target.value })} placeholder="Ex: Peito esquerdo, 8cm do decote" />
                </div>
                <div>
                  <label className="text-sm">Tamanho</label>
                  <Input value={newForm.size_notes} onChange={(e) => setNewForm({ ...newForm, size_notes: e.target.value })} placeholder="Ex: 12 x 8 cm" />
                </div>
                <Button className="w-full" onClick={() => createArtwork.mutate()} disabled={createArtwork.isPending}>Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({artworks.length})</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejeitadas">Rejeitadas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma arte nesta categoria.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => {
                const meta = STATUS_META[a.status] ?? STATUS_META.rascunho;
                return (
                  <Card key={a.id} className="cursor-pointer hover:border-primary transition" onClick={() => setSelected(a)}>
                    <div className="h-40 w-full bg-muted overflow-hidden rounded-t-lg">
                      {a.artwork_url ? (
                        <img src={a.artwork_url} alt={a.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <ImageIcon className="size-8" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm truncate">{a.name}</CardTitle>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
                      <p>Técnica: {TECHNIQUES.find((t) => t.v === a.technique)?.l ?? a.technique}</p>
                      {a.position_notes && <p>Pos: {a.position_notes}</p>}
                      {a.colors.length > 0 && (
                        <div className="flex gap-1 pt-1">
                          {a.colors.slice(0, 6).map((c) => (
                            <span key={c} className="w-4 h-4 rounded-full border" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selected && <ArtworkDetailDialog artwork={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

type Proof = {
  id: string;
  artwork_id: string;
  round: number;
  proof_url: string | null;
  notes: string | null;
  status: "pendente" | "aprovada" | "ajuste" | "rejeitada";
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function ArtworkDetailDialog({ artwork, onClose }: { artwork: Artwork; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [proofUrl, setProofUrl] = useState("");
  const [proofNotes, setProofNotes] = useState("");

  const { data: proofs = [] } = useQuery({
    queryKey: ["print-proofs", artwork.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_proofs")
        .select("*")
        .eq("artwork_id", artwork.id)
        .order("round", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Proof[];
    },
  });

  const addProof = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      if (!proofUrl) throw new Error("Envie a imagem da prova");
      const nextRound = (proofs[0]?.round ?? 0) + 1;
      const { error } = await supabase.from("print_proofs").insert({
        artwork_id: artwork.id,
        owner_id: user.id,
        round: nextRound,
        proof_url: proofUrl,
        notes: proofNotes.trim() || null,
        status: "pendente",
      });
      if (error) throw error;
      await supabase.from("print_artworks").update({ status: "em_prova" }).eq("id", artwork.id);
    },
    onSuccess: () => {
      toast.success("Prova registrada");
      setProofUrl("");
      setProofNotes("");
      qc.invalidateQueries({ queryKey: ["print-proofs", artwork.id] });
      qc.invalidateQueries({ queryKey: ["print-artworks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewProof = useMutation({
    mutationFn: async ({ proofId, status, notes }: { proofId: string; status: Proof["status"]; notes?: string }) => {
      const { error } = await supabase
        .from("print_proofs")
        .update({ status, reviewer_id: user?.id, reviewed_at: new Date().toISOString(), reviewer_notes: notes ?? null })
        .eq("id", proofId);
      if (error) throw error;
      if (status === "aprovada") {
        await supabase.from("print_artworks").update({ status: "aprovada" }).eq("id", artwork.id);
      } else if (status === "rejeitada") {
        await supabase.from("print_artworks").update({ status: "rejeitada" }).eq("id", artwork.id);
      } else if (status === "ajuste") {
        await supabase.from("print_artworks").update({ status: "aguardando_prova" }).eq("id", artwork.id);
      }
    },
    onSuccess: () => {
      toast.success("Prova revisada");
      qc.invalidateQueries({ queryKey: ["print-proofs", artwork.id] });
      qc.invalidateQueries({ queryKey: ["print-artworks"] });
    },
  });

  const release = useMutation({
    mutationFn: async () => {
      if (artwork.status !== "aprovada") throw new Error("Só é possível liberar artes aprovadas");
      const { error } = await supabase
        .from("print_artworks")
        .update({ status: "liberada_producao", released_at: new Date().toISOString(), released_by: user?.id })
        .eq("id", artwork.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arte liberada para produção 🎉");
      qc.invalidateQueries({ queryKey: ["print-artworks"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = STATUS_META[artwork.status];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {artwork.name}
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {artwork.artwork_url && (
            <img src={artwork.artwork_url} alt={artwork.name} loading="lazy" decoding="async" className="w-full max-h-64 object-contain rounded border" />
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Técnica:</span> {TECHNIQUES.find((t) => t.v === artwork.technique)?.l}</div>
            <div><span className="text-muted-foreground">Posição:</span> {artwork.position_notes ?? "—"}</div>
            <div><span className="text-muted-foreground">Tamanho:</span> {artwork.size_notes ?? "—"}</div>
            <div><span className="text-muted-foreground">Cores:</span> {artwork.colors.length}</div>
          </div>

          {artwork.status === "aprovada" && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-green-600" />
                  <span className="text-sm">Arte aprovada — pronta para liberar ao fornecedor.</span>
                </div>
                <Button onClick={() => release.mutate()} disabled={release.isPending}>
                  <Send className="size-4 mr-1" /> Liberar para produção
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rounds */}
          <div>
            <h3 className="font-medium mb-2">Provas de cor</h3>
            <div className="space-y-3">
              {proofs.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Round #{p.round}</Badge>
                      <Badge variant={
                        p.status === "aprovada" ? "default" :
                        p.status === "rejeitada" ? "destructive" :
                        p.status === "ajuste" ? "secondary" : "outline"
                      }>{p.status}</Badge>
                    </div>
                    {p.proof_url && <img src={p.proof_url} alt={`Round ${p.round}`} loading="lazy" decoding="async" className="w-full max-h-40 object-contain rounded border" />}
                    {p.notes && <p className="text-xs text-muted-foreground">Notas: {p.notes}</p>}
                    {p.reviewer_notes && <p className="text-xs">Revisão: {p.reviewer_notes}</p>}
                    {p.status === "pendente" && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="default" onClick={() => reviewProof.mutate({ proofId: p.id, status: "aprovada" })}>
                          <CheckCircle2 className="size-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => {
                          const n = prompt("O que ajustar?"); if (n) reviewProof.mutate({ proofId: p.id, status: "ajuste", notes: n });
                        }}>
                          <AlertTriangle className="size-3 mr-1" /> Pedir ajuste
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          const n = prompt("Motivo da rejeição?"); if (n) reviewProof.mutate({ proofId: p.id, status: "rejeitada", notes: n });
                        }}>
                          <XCircle className="size-3 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {proofs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma prova ainda.</p>}
            </div>

            {/* New proof */}
            {artwork.status !== "liberada_producao" && (
              <Card className="mt-3">
                <CardHeader><CardTitle className="text-sm">Registrar nova prova</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <StorageUploader bucket="prototypes" value={proofUrl || null} onChange={(url) => setProofUrl(url ?? "")} accept="image/*" kind="image" />
                  {proofUrl && <img src={proofUrl} alt="Preview" className="max-h-32 rounded border" />}
                  <Textarea value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} placeholder="Observações da prova (cor, malha, alinhamento)…" />
                  <Button onClick={() => addProof.mutate()} disabled={addProof.isPending || !proofUrl} className="w-full">
                    Enviar prova (Round #{(proofs[0]?.round ?? 0) + 1})
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
