import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  Star,
  ClipboardCheck,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores · USE MODA OS" },
      { name: "description", content: "Gestão de fornecedores da operação." },
    ],
  }),
  component: FornecedoresPage,
});

type Supplier = {
  id: string;
  owner_id: string;
  name: string;
  category: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  rating: number;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type SampleStatus = "received" | "pending_review" | "approved" | "rejected" | "needs_adjustment";
type ReviewAction = Extract<SampleStatus, "approved" | "rejected" | "needs_adjustment">;
type SupplierSample = {
  id: string;
  supplier_id: string;
  production_order_id: string | null;
  rfq_id: string | null;
  file_name: string;
  file_path: string;
  mime: string | null;
  size: number | null;
  sample_status: SampleStatus;
  checklist: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  suppliers: { name: string } | null;
  production_orders: { code: string } | null;
  rfq_requests: { code: string; title: string } | null;
};

const SAMPLE_STATUS_LABEL: Record<SampleStatus, string> = {
  received: "Recebida",
  pending_review: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
  needs_adjustment: "Ajuste",
};

function FornecedoresPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [reviewing, setReviewing] = useState<{
    sample: SupplierSample;
    action: ReviewAction;
  } | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: samples = [], isLoading: isLoadingSamples } = useQuery({
    queryKey: ["supplier-samples"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_portal_attachments")
        .select(
          "id, supplier_id, production_order_id, rfq_id, file_name, file_path, mime, size, sample_status, checklist, notes, created_at, suppliers(name), production_orders(code), rfq_requests(code, title)",
        )
        .eq("attachment_kind", "sample")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as SupplierSample[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: async ({
      sample,
      action,
      notes,
    }: {
      sample: SupplierSample;
      action: ReviewAction;
      notes: string;
    }) => {
      const checklist = {
        ...(sample.checklist ?? {}),
        internal_review: {
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewer_id: user?.id ?? null,
        },
      };
      const { error } = await supabase
        .from("supplier_portal_attachments")
        .update({
          sample_status: action,
          notes: notes.trim() || sample.notes,
          checklist,
        })
        .eq("id", sample.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-samples"] });
      toast.success("Amostra validada");
      setReviewing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = suppliers.length;
  const ativos = suppliers.filter((s) => s.active).length;
  const pendingSamples = samples.filter((s) =>
    ["received", "pending_review", "needs_adjustment"].includes(s.sample_status),
  );
  const avgRating = total
    ? (suppliers.reduce((a, s) => a + (s.rating || 0), 0) / total).toFixed(1)
    : "—";
  const topCats = Object.entries(
    suppliers.reduce<Record<string, number>>((m, s) => {
      const k = s.category || "Sem categoria";
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  async function generatePortalLink(supplierId: string) {
    if (!user) return;
    const token =
      (crypto as any).randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from("supplier_portal_tokens").insert({
      owner_id: user.id,
      supplier_id: supplierId,
      token,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const url = `${window.location.origin}/portal/fornecedor/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado: " + url);
    } catch {
      toast.success(url);
    }
  }

  async function openSampleFile(sample: SupplierSample) {
    const { data, error } = await supabase.storage
      .from("supplier-uploads")
      .createSignedUrl(sample.file_path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Truck className="size-6 text-primary" /> Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sua rede de parceiros — tecidos, aviamentos, costura e mais.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" /> Novo Fornecedor
        </Button>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="text-2xl font-semibold">{total}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Ativos</div>
            <div className="text-2xl font-semibold text-emerald-400">{ativos}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Amostras</div>
            <div className="text-2xl font-semibold text-primary">{pendingSamples.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Avaliação média
            </div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              {avgRating}
              <Star className="size-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Top categorias
            </div>
            <div className="flex flex-wrap gap-1">
              {topCats.map(([c, n]) => (
                <Badge key={c} variant="outline" className="text-[10px]">
                  {c} · {n}
                </Badge>
              ))}
              {!topCats.length && <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" />
              Validação interna de amostras
            </h2>
            <p className="text-xs text-muted-foreground">
              Arquivos enviados pelo portal do fornecedor para aprovação, ajuste ou reprovação.
            </p>
          </div>
          <Badge variant="outline">{pendingSamples.length} pendente(s)</Badge>
        </div>
        {isLoadingSamples ? (
          <div className="text-sm text-muted-foreground">Carregando amostras…</div>
        ) : samples.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma amostra enviada pelo portal ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="rounded-lg border border-border bg-background/60 p-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-medium truncate">{sample.file_name}</span>
                    <SampleStatusBadge status={sample.sample_status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>{sample.suppliers?.name ?? "Fornecedor"}</span>
                    <span>
                      {sample.production_orders?.code
                        ? `OP ${sample.production_orders.code}`
                        : sample.rfq_requests?.code
                          ? `RFQ ${sample.rfq_requests.code}`
                          : "Sem vínculo operacional"}
                    </span>
                    <span>{new Date(sample.created_at).toLocaleDateString("pt-BR")}</span>
                    {sample.size ? <span>{Math.round(sample.size / 1024)} KB</span> : null}
                  </div>
                  {sample.notes && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      Obs.: {sample.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <Button variant="outline" size="sm" onClick={() => openSampleFile(sample)}>
                    <ExternalLink className="size-3.5" /> Abrir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-500 border-emerald-500/30"
                    onClick={() => setReviewing({ sample, action: "approved" })}
                  >
                    <CheckCircle2 className="size-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-500 border-amber-500/30"
                    onClick={() => setReviewing({ sample, action: "needs_adjustment" })}
                  >
                    <AlertTriangle className="size-3.5" /> Ajustar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30"
                    onClick={() => setReviewing({ sample, action: "rejected" })}
                  >
                    <XCircle className="size-3.5" /> Reprovar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : suppliers.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Nenhum fornecedor ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Cadastre seu primeiro parceiro.</p>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Cadastrar fornecedor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="glass rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{s.name}</h3>
                  {s.category && (
                    <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.active ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    >
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>
              {s.rating > 0 && (
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < s.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                    />
                  ))}
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                {s.contact_name && <p className="text-muted-foreground">{s.contact_name}</p>}
                {s.email && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="size-3" /> {s.email}
                  </p>
                )}
                {s.phone && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="size-3" /> {s.phone}
                  </p>
                )}
                {(s.city || s.state) && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {[s.city, s.state].filter(Boolean).join(" / ")}
                  </p>
                )}
              </div>
              {s.notes && <p className="text-xs text-muted-foreground line-clamp-2">{s.notes}</p>}
              {s.owner_id === user?.id && (
                <div className="flex justify-end gap-1 pt-2 border-t border-border">
                  <button
                    onClick={() => generatePortalLink(s.id)}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border hover:bg-muted"
                  >
                    Link do portal
                  </button>
                  <button
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                    className="size-7 grid place-items-center rounded hover:bg-muted"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => confirm("Remover este fornecedor?") && deleteMut.mutate(s.id)}
                    className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SupplierDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
      <ReviewSampleDialog
        review={reviewing}
        onOpenChange={(v) => !v && setReviewing(null)}
        onConfirm={(notes) => {
          if (!reviewing) return;
          reviewMut.mutate({ ...reviewing, notes });
        }}
        pending={reviewMut.isPending}
      />
    </div>
  );
}

function SampleStatusBadge({ status }: { status: SampleStatus }) {
  const cls =
    status === "approved"
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
      : status === "rejected"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : status === "needs_adjustment"
          ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
          : "bg-primary/10 text-primary border-primary/30";
  return (
    <Badge variant="outline" className={cls}>
      {SAMPLE_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function ReviewSampleDialog({
  review,
  onOpenChange,
  onConfirm,
  pending,
}: {
  review: { sample: SupplierSample; action: ReviewAction } | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (notes: string) => void;
  pending: boolean;
}) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (review) setNotes(review.sample.notes ?? "");
  }, [review]);

  const title =
    review?.action === "approved"
      ? "Aprovar amostra"
      : review?.action === "needs_adjustment"
        ? "Solicitar ajuste"
        : "Reprovar amostra";

  return (
    <Dialog open={!!review} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Registre a decisão interna para {review?.sample.file_name ?? "a amostra"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Observação da validação</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Ex.: aprovada para piloto, ajustar medida P, reprovar acabamento..."
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(notes)} disabled={pending}>
            {pending ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierDialog({
  open,
  onOpenChange,
  editing,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Supplier | null;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open && editing) {
      setName(editing.name);
      setCategory(editing.category || "");
      setContactName(editing.contact_name || "");
      setEmail(editing.email || "");
      setPhone(editing.phone || "");
      setCity(editing.city || "");
      setState(editing.state || "");
      setRating(editing.rating);
      setNotes(editing.notes || "");
      setActive(editing.active);
    } else if (open) {
      reset();
    }
  }, [open, editing]);

  function reset() {
    setName("");
    setCategory("");
    setContactName("");
    setEmail("");
    setPhone("");
    setCity("");
    setState("");
    setRating(0);
    setNotes("");
    setActive(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        name,
        category: category || null,
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        city: city || null,
        state: state || null,
        rating,
        notes: notes || null,
        active,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editing ? "Fornecedor atualizado" : "Fornecedor criado");
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>Dados de contato e avaliação do parceiro.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tecidos São Paulo"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Tecidos"
              />
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Maria"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Avaliação ({rating}/5)</Label>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i + 1 === rating ? 0 : i + 1)}
                >
                  <Star
                    className={`size-6 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label>Fornecedor ativo</Label>
              <p className="text-xs text-muted-foreground">Desative para arquivar sem excluir.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
