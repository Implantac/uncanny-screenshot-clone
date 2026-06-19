import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, MessageCircle, Paperclip, Upload, FileText, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/portal/fornecedor/$token")({
  head: () => ({
    meta: [
      { title: "Portal do Fornecedor · USE MODA OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SupplierPortalPage,
});

type Rfq = {
  id: string;
  code: string;
  title: string;
  quantity: number;
  unit: string | null;
  needed_by: string | null;
  status: string;
};
type Quote = {
  id: string;
  rfq_id: string;
  unit_price: number;
  lead_time_days: number | null;
  moq: number | null;
  payment_terms: string | null;
  awarded: boolean;
};
type ProductionOrder = {
  id: string;
  code: string;
  quantity: number;
  due_date: string | null;
  stage: string | null;
  status: string;
  products: { name: string | null; sku: string | null } | null;
};
type Ack = {
  id: string;
  production_order_id: string;
  decision: string;
  counter_due_date: string | null;
  notes: string | null;
  created_at: string;
};
type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  mime: string | null;
  size: number | null;
  rfq_id: string | null;
  production_order_id: string | null;
  attachment_kind: AttachmentKind;
  sample_status: SampleStatus;
  checklist: SampleChecklist;
  notes: string | null;
  created_at: string;
};
type Data = {
  supplier: { id: string; name: string } | null;
  rfqs: Rfq[];
  quotes: Quote[];
  production_orders: ProductionOrder[];
  acks: Ack[];
  attachments: Attachment[];
};

type AttachmentKind = "document" | "sample" | "photo" | "invoice" | "other";
type SampleStatus = "received" | "pending_review" | "approved" | "rejected" | "needs_adjustment";
type SampleChecklist = Partial<{
  measurements: boolean;
  finishing: boolean;
  color: boolean;
  fabric: boolean;
  packaging: boolean;
}>;

const KIND_LABEL: Record<AttachmentKind, string> = {
  document: "Documento",
  sample: "Amostra",
  photo: "Foto",
  invoice: "Nota",
  other: "Outro",
};

const STATUS_LABEL: Record<SampleStatus, string> = {
  received: "recebida",
  pending_review: "em análise",
  approved: "aprovada",
  rejected: "reprovada",
  needs_adjustment: "ajustar",
};

const CHECKLIST_LABEL: Record<keyof SampleChecklist, string> = {
  measurements: "medidas",
  finishing: "acabamento",
  color: "cor",
  fabric: "tecido",
  packaging: "embalagem",
};

function SupplierPortalPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/supplier-portal/${token}`);
      if (!res.ok) {
        setError(res.status === 410 ? "Link expirado." : "Link inválido.");
        return;
      }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, [token]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>
    );
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Portal do Fornecedor</h1>
          <p className="text-sm text-muted-foreground">
            Olá, <strong>{data.supplier?.name ?? "fornecedor"}</strong> — confirme ordens, envie
            cotações e anexe documentos.
          </p>
        </header>

        {(data.production_orders?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Suas ordens de produção ativas</h2>
            <div className="grid gap-2">
              {data.production_orders.map((po) => {
                const ack = data.acks.find((a) => a.production_order_id === po.id);
                const atts = data.attachments.filter((a) => a.production_order_id === po.id);
                return (
                  <OrderCard
                    key={po.id}
                    po={po}
                    ack={ack}
                    attachments={atts}
                    token={token}
                    onChanged={reload}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Cotações abertas (RFQ)</h2>
          {data.rfqs.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-muted-foreground">
              Nenhuma RFQ aberta no momento.
            </div>
          ) : (
            <div className="space-y-4">
              {data.rfqs.map((rfq) => {
                const my = data.quotes.find((q) => q.rfq_id === rfq.id);
                const atts = data.attachments.filter((a) => a.rfq_id === rfq.id);
                return (
                  <RfqCard
                    key={rfq.id}
                    rfq={rfq}
                    myQuote={my}
                    attachments={atts}
                    token={token}
                    onSaved={reload}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OrderCard({
  po,
  ack,
  attachments,
  token,
  onChanged,
}: {
  po: ProductionOrder;
  ack?: Ack;
  attachments: Attachment[];
  token: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "declined" | "counter">("accepted");
  const [counterDate, setCounterDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch(`/api/public/supplier-portal/${token}?action=ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          production_order_id: po.id,
          decision,
          counter_due_date: decision === "counter" ? counterDate : null,
          notes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Resposta enviada");
      setOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{po.code}</div>
          <div className="font-medium">{po.products?.name ?? po.products?.sku ?? "Produto"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {po.quantity} un · estágio <strong>{po.stage ?? "—"}</strong>
            {po.due_date ? (
              <>
                {" "}
                · entrega <strong>{new Date(po.due_date).toLocaleDateString("pt-BR")}</strong>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline">{po.status}</Badge>
          {ack && (
            <Badge
              variant={
                ack.decision === "accepted"
                  ? "default"
                  : ack.decision === "declined"
                    ? "destructive"
                    : "secondary"
              }
            >
              {ack.decision === "accepted"
                ? "aceita"
                : ack.decision === "declined"
                  ? "recusada"
                  : "contraproposta"}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {!ack && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDecision("accepted");
                setOpen(true);
              }}
            >
              <Check className="size-3.5 mr-1" />
              Aceitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDecision("counter");
                setOpen(true);
              }}
            >
              <MessageCircle className="size-3.5 mr-1" />
              Contraproposta
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDecision("declined");
                setOpen(true);
              }}
            >
              <X className="size-3.5 mr-1" />
              Recusar
            </Button>
          </>
        )}
        <FileUploader token={token} orderId={po.id} onUploaded={onChanged} />
      </div>

      <AttachmentList attachments={attachments} />

      {open && (
        <div className="border border-border rounded-lg p-3 mt-2 space-y-2 bg-muted/20">
          {decision === "counter" && (
            <div>
              <Label className="text-xs">Nova data sugerida</Label>
              <Input
                type="date"
                value={counterDate}
                onChange={(e) => setCounterDate(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={decision === "declined" ? "Motivo da recusa…" : "Comentário…"}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={send}
              disabled={busy || (decision === "counter" && !counterDate)}
            >
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileUploader({
  token,
  rfqId,
  orderId,
  onUploaded,
}: {
  token: string;
  rfqId?: string;
  orderId?: string;
  onUploaded: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<AttachmentKind>(orderId ? "sample" : "document");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<SampleChecklist>({});

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      if (rfqId) fd.append("rfq_id", rfqId);
      if (orderId) fd.append("production_order_id", orderId);
      fd.append("attachment_kind", kind);
      fd.append("sample_status", kind === "sample" ? "pending_review" : "received");
      fd.append("notes", notes);
      fd.append("check_measurements", String(Boolean(checklist.measurements)));
      fd.append("check_finishing", String(Boolean(checklist.finishing)));
      fd.append("check_color", String(Boolean(checklist.color)));
      fd.append("check_fabric", String(Boolean(checklist.fabric)));
      fd.append("check_packaging", String(Boolean(checklist.packaging)));
      const res = await fetch(`/api/public/supplier-portal/${token}?action=upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(kind === "sample" ? "Amostra enviada" : "Arquivo enviado");
      setExpanded(false);
      setNotes("");
      setChecklist({});
      onUploaded();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={onPick}
        accept="image/*,application/pdf,.xlsx,.csv,.doc,.docx"
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setExpanded(!expanded)}>
        {busy ? (
          <Upload className="size-3.5 mr-1 animate-pulse" />
        ) : (
          <Paperclip className="size-3.5 mr-1" />
        )}
        {orderId ? "Enviar amostra" : "Anexar"}
      </Button>
      {expanded && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(event) => setKind(event.target.value as AttachmentKind)}
              >
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: amostra P aprovada pelo fornecedor"
              />
            </div>
          </div>

          {kind === "sample" && (
            <div className="space-y-2">
              <div className="text-xs font-medium flex items-center gap-1.5">
                <ClipboardCheck className="size-3.5" />
                Checklist declarado
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {(Object.keys(CHECKLIST_LABEL) as Array<keyof SampleChecklist>).map((key) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[key])}
                      onChange={(event) =>
                        setChecklist((current) => ({ ...current, [key]: event.target.checked }))
                      }
                    />
                    {CHECKLIST_LABEL[key]}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={busy} onClick={() => ref.current?.click()}>
              Selecionar arquivo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RfqCard({
  rfq,
  myQuote,
  attachments,
  token,
  onSaved,
}: {
  rfq: Rfq;
  myQuote?: Quote;
  attachments: Attachment[];
  token: string;
  onSaved: () => void;
}) {
  const [unitPrice, setUnitPrice] = useState(String(myQuote?.unit_price ?? ""));
  const [leadTime, setLeadTime] = useState(String(myQuote?.lead_time_days ?? "0"));
  const [moq, setMoq] = useState(String(myQuote?.moq ?? "0"));
  const [terms, setTerms] = useState(myQuote?.payment_terms ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/public/supplier-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfq_id: rfq.id,
          unit_price: Number(unitPrice),
          lead_time_days: Number(leadTime),
          moq: Number(moq),
          payment_terms: terms || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Cotação enviada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{rfq.code}</div>
          <div className="font-semibold">{rfq.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Quantidade:{" "}
            <strong>
              {rfq.quantity}
              {rfq.unit ?? ""}
            </strong>
            {rfq.needed_by ? (
              <>
                {" "}
                · Necessário até{" "}
                <strong>{new Date(rfq.needed_by).toLocaleDateString("pt-BR")}</strong>
              </>
            ) : null}
          </div>
        </div>
        {myQuote?.awarded ? (
          <Badge>vencedora</Badge>
        ) : myQuote ? (
          <Badge variant="secondary">enviada</Badge>
        ) : (
          <Badge variant="outline">pendente</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Preço unit. (R$)</Label>
          <Input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            type="number"
            step="0.01"
          />
        </div>
        <div>
          <Label className="text-xs">Lead time (dias)</Label>
          <Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} type="number" />
        </div>
        <div>
          <Label className="text-xs">MOQ</Label>
          <Input value={moq} onChange={(e) => setMoq(e.target.value)} type="number" />
        </div>
        <div>
          <Label className="text-xs">Condição de pagamento</Label>
          <Input
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="ex.: 30/60/90"
          />
        </div>
      </div>
      <AttachmentList attachments={attachments} />
      <div className="flex justify-end gap-2">
        <FileUploader token={token} rfqId={rfq.id} onUploaded={onSaved} />
        <Button onClick={save} disabled={saving || !unitPrice}>
          {saving ? "Enviando…" : myQuote ? "Atualizar cotação" : "Enviar cotação"}
        </Button>
      </div>
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const checked = (Object.keys(CHECKLIST_LABEL) as Array<keyof SampleChecklist>).filter(
          (key) => attachment.checklist?.[key],
        );
        return (
          <span
            key={attachment.id}
            className="inline-flex max-w-full items-center gap-1 rounded bg-muted px-2 py-1"
            title={attachment.notes ?? attachment.file_name}
          >
            <FileText className="size-3 shrink-0" />
            <span className="truncate">{attachment.file_name}</span>
            <Badge variant="outline" className="h-5 text-[10px]">
              {KIND_LABEL[attachment.attachment_kind] ?? "Arquivo"}
            </Badge>
            {attachment.attachment_kind === "sample" && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {STATUS_LABEL[attachment.sample_status] ?? "recebida"}
                {checked.length ? ` · ${checked.length}/5` : ""}
              </Badge>
            )}
          </span>
        );
      })}
    </div>
  );
}
