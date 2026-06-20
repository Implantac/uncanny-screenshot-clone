import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Trophy, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { SupplierRecommender } from "@/components/supplier-recommender";

export const Route = createFileRoute("/_authenticated/_app/sourcing")({
  head: () => ({
    meta: [
      { title: "Sourcing & RFQ · USE MODA PLM" },
      { name: "description", content: "Cotações de materiais com múltiplos fornecedores." },
    ],
  }),
  component: Page,
});

type Rfq = {
  id: string;
  code: string;
  title: string;
  quantity: number;
  unit: string;
  status: string;
  needed_by: string | null;
  awarded_quote_id: string | null;
};
type Quote = {
  id: string;
  rfq_id: string;
  supplier_name: string | null;
  unit_price: number;
  lead_time_days: number;
  moq: number;
  awarded: boolean;
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [rfqForm, setRfqForm] = useState({ code: "", title: "", quantity: 0, unit: "m" });
  const [quoteForm, setQuoteForm] = useState({
    supplier_name: "",
    unit_price: 0,
    lead_time_days: 0,
    moq: 0,
  });

  const rfqs = useQuery({
    queryKey: ["rfqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Rfq[];
    },
  });

  const quotes = useQuery({
    queryKey: ["rfq-quotes", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_quotes")
        .select("*")
        .eq("rfq_id", selected)
        .order("unit_price");
      if (error) throw error;
      return (data ?? []) as Quote[];
    },
  });

  const addRfq = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rfq_requests")
        .insert({ owner_id: user!.id, ...rfqForm });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RFQ criada");
      setRfqForm({ code: "", title: "", quantity: 0, unit: "m" });
      qc.invalidateQueries({ queryKey: ["rfqs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addQuote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rfq_quotes")
        .insert({ owner_id: user!.id, rfq_id: selected, ...quoteForm });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuoteForm({ supplier_name: "", unit_price: 0, lead_time_days: 0, moq: 0 });
      qc.invalidateQueries({ queryKey: ["rfq-quotes", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const award = useMutation({
    mutationFn: async (q: Quote) => {
      await supabase.from("rfq_quotes").update({ awarded: false }).eq("rfq_id", q.rfq_id);
      await supabase.from("rfq_quotes").update({ awarded: true }).eq("id", q.id);
      await supabase
        .from("rfq_requests")
        .update({ awarded_quote_id: q.id, status: "decidida" })
        .eq("id", q.rfq_id);
    },
    onSuccess: () => {
      toast.success("Cotação vencedora definida");
      qc.invalidateQueries();
    },
  });

  return (
    <div className="p-6 grid lg:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Sourcing / RFQ</h1>
        </div>

        <div className="glass rounded-xl p-3 space-y-2">
          <Input
            placeholder="Código"
            value={rfqForm.code}
            onChange={(e) => setRfqForm({ ...rfqForm, code: e.target.value })}
          />
          <Input
            placeholder="Título"
            value={rfqForm.title}
            onChange={(e) => setRfqForm({ ...rfqForm, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Qtd"
              value={rfqForm.quantity}
              onChange={(e) => setRfqForm({ ...rfqForm, quantity: Number(e.target.value) })}
            />
            <Input
              placeholder="Unid"
              value={rfqForm.unit}
              onChange={(e) => setRfqForm({ ...rfqForm, unit: e.target.value })}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => addRfq.mutate()}
            disabled={!rfqForm.code || !rfqForm.title}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova RFQ
          </Button>
        </div>

        <div className="space-y-2">
          {rfqs.data?.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`w-full text-left glass rounded-lg p-3 hover:bg-accent/30 ${selected === r.id ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.code}</span>
                <Badge variant={r.status === "decidida" ? "default" : "outline"}>{r.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{r.title}</p>
              <p className="text-xs">
                {r.quantity} {r.unit}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {!selected ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">
            Selecione uma RFQ para gerenciar cotações.
          </div>
        ) : (
          <>
            <SupplierRecommender rfqTitle={rfqs.data?.find((r) => r.id === selected)?.title} />
            <div className="glass rounded-xl p-4">
              <h2 className="font-semibold mb-3">Adicionar cotação</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Input
                  placeholder="Fornecedor"
                  value={quoteForm.supplier_name}
                  onChange={(e) => setQuoteForm({ ...quoteForm, supplier_name: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Preço unit."
                  value={quoteForm.unit_price}
                  onChange={(e) =>
                    setQuoteForm({ ...quoteForm, unit_price: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  placeholder="Lead (dias)"
                  value={quoteForm.lead_time_days}
                  onChange={(e) =>
                    setQuoteForm({ ...quoteForm, lead_time_days: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  placeholder="MOQ"
                  value={quoteForm.moq}
                  onChange={(e) => setQuoteForm({ ...quoteForm, moq: Number(e.target.value) })}
                />
                <Button onClick={() => addQuote.mutate()} disabled={!quoteForm.supplier_name}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-3">Fornecedor</th>
                    <th className="text-right p-3">Preço unit.</th>
                    <th className="text-right p-3">Lead</th>
                    <th className="text-right p-3">MOQ</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.data?.map((q) => (
                    <tr key={q.id} className={`border-t ${q.awarded ? "bg-primary/10" : ""}`}>
                      <td className="p-3">
                        {q.supplier_name}{" "}
                        {q.awarded && <Trophy className="inline h-4 w-4 ml-1 text-primary" />}
                      </td>
                      <td className="text-right p-3 font-medium">
                        R$ {Number(q.unit_price).toFixed(2)}
                      </td>
                      <td className="text-right p-3">{q.lead_time_days}d</td>
                      <td className="text-right p-3">{q.moq}</td>
                      <td className="p-3 text-right">
                        {!q.awarded && (
                          <Button size="sm" variant="outline" onClick={() => award.mutate(q)}>
                            Premiar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {quotes.data?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Sem cotações ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
