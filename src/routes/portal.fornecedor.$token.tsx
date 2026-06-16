import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/fornecedor/$token")({
  head: () => ({
    meta: [
      { title: "Portal do Fornecedor · USE MODA OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SupplierPortalPage,
});

type Rfq = { id: string; code: string; title: string; quantity: number; unit: string | null; needed_by: string | null; status: string };
type Quote = { id: string; rfq_id: string; unit_price: number; lead_time_days: number | null; moq: number | null; payment_terms: string | null; awarded: boolean };
type Data = { supplier: { id: string; name: string } | null; rfqs: Rfq[]; quotes: Quote[] };

function SupplierPortalPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/supplier-portal/${token}`);
      if (!res.ok) { setError(res.status === 410 ? "Link expirado." : "Link inválido."); return; }
      setData(await res.json());
      setError(null);
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Portal do Fornecedor</h1>
          <p className="text-sm text-muted-foreground">Olá, <strong>{data.supplier?.name ?? "fornecedor"}</strong> — envie ou atualize cotações abaixo.</p>
        </header>

        {data.rfqs.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhuma RFQ aberta no momento.</div>
        ) : (
          <div className="space-y-4">
            {data.rfqs.map((rfq) => {
              const my = data.quotes.find((q) => q.rfq_id === rfq.id);
              return <RfqCard key={rfq.id} rfq={rfq} myQuote={my} token={token} onSaved={reload} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RfqCard({ rfq, myQuote, token, onSaved }: { rfq: Rfq; myQuote?: Quote; token: string; onSaved: () => void }) {
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
    } finally { setSaving(false); }
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{rfq.code}</div>
          <div className="font-semibold">{rfq.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Quantidade: <strong>{rfq.quantity}{rfq.unit ?? ""}</strong>
            {rfq.needed_by ? <> · Necessário até <strong>{new Date(rfq.needed_by).toLocaleDateString("pt-BR")}</strong></> : null}
          </div>
        </div>
        {myQuote?.awarded ? <Badge>vencedora</Badge> : myQuote ? <Badge variant="secondary">enviada</Badge> : <Badge variant="outline">pendente</Badge>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Preço unit. (R$)</Label><Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} type="number" step="0.01" /></div>
        <div><Label className="text-xs">Lead time (dias)</Label><Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} type="number" /></div>
        <div><Label className="text-xs">MOQ</Label><Input value={moq} onChange={(e) => setMoq(e.target.value)} type="number" /></div>
        <div><Label className="text-xs">Condição de pagamento</Label><Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="ex.: 30/60/90" /></div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !unitPrice}>{saving ? "Enviando…" : myQuote ? "Atualizar cotação" : "Enviar cotação"}</Button>
      </div>
    </div>
  );
}
