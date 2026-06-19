import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Clock, ArrowRight, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/onde-esta")({
  head: () => ({
    meta: [
      { title: "Onde está? · USE MODA OS" },
      { name: "description", content: "Rastreabilidade visual de OPs e lotes" },
    ],
  }),
  component: OndeEsta,
});

type LogRow = {
  id: string;
  order_id: string;
  from_stage: string | null;
  to_stage: string;
  quantity: number;
  is_partial: boolean;
  note: string | null;
  created_at: string;
};
type OrderRow = {
  id: string;
  code: string;
  stage: string;
  quantity: number;
  stage_updated_at: string | null;
  product_id: string | null;
  supplier_id: string | null;
};
type BatchRow = {
  id: string;
  code: string;
  status: string;
  planned_qty: number;
  produced_qty: number;
};

const STAGE_LABEL: Record<string, string> = {
  cad: "CAD",
  modelagem: "Modelagem",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  concluido: "Concluído",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1) return `${Math.floor(diff / 60000)} min`;
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

function OndeEsta() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: order, isLoading: loadingOrder } = useQuery({
    enabled: !!submitted,
    queryKey: ["traceability-order", submitted],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("id,code,stage,quantity,stage_updated_at,product_id,supplier_id")
        .ilike("code", `%${submitted}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as OrderRow | null;
    },
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    enabled: !!order?.id,
    queryKey: ["traceability-logs", order?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stage_log")
        .select("*")
        .eq("order_id", order!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as LogRow[];
    },
  });

  const { data: product } = useQuery({
    enabled: !!order?.product_id,
    queryKey: ["traceability-product", order?.product_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("name")
        .eq("id", order!.product_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: batch, isLoading: loadingBatch } = useQuery({
    enabled: !!submitted && !loadingOrder && !order,
    queryKey: ["traceability-batch", submitted],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_batches")
        .select("id,code,status,planned_qty,produced_qty")
        .ilike("code", `%${submitted}%`)
        .limit(1)
        .maybeSingle();
      return data as BatchRow | null;
    },
  });

  const { data: batchOrders = [] } = useQuery({
    enabled: !!batch?.code,
    queryKey: ["traceability-batch-orders", batch?.code],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select("id,code,stage,quantity,stage_updated_at,product_id,supplier_id")
        .eq("batch_code", batch!.code)
        .limit(50);
      return (data ?? []) as OrderRow[];
    },
  });
  const { data: supplier } = useQuery({
    enabled: !!order?.supplier_id,
    queryKey: ["traceability-supplier", order?.supplier_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("name")
        .eq("id", order!.supplier_id!)
        .maybeSingle();
      return data;
    },
  });

  const currentSince = useMemo(() => {
    if (!order?.stage_updated_at) return null;
    return relTime(order.stage_updated_at);
  }, [order]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
          <MapPin className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Onde está?</h1>
          <p className="text-sm text-muted-foreground">
            Digite o código da OP — veja a jornada completa em segundos.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: OP-20260101-abc123"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!query.trim()}>
          Rastrear
        </Button>
      </form>

      {submitted && loadingOrder && <p className="text-muted-foreground text-sm">Procurando…</p>}

      {submitted && !loadingOrder && !loadingBatch && !order && !batch && (
        <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
          <Package className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma OP encontrada para "{submitted}".</p>
        </div>
      )}

      {batch && !order && (
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-mono text-xs text-muted-foreground">{batch.code}</div>
              <div className="text-lg font-semibold mt-1">Lote encontrado</div>
              <div className="text-xs text-muted-foreground">
                {batchOrders.length} OPs vinculadas · {batch.produced_qty}/{batch.planned_qty} pç ·
                status {batch.status}
              </div>
            </div>
            <Link to="/lotes">
              <Button size="sm" variant="outline">
                Abrir rastreabilidade do lote
              </Button>
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {batchOrders.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-border bg-background/30 p-3 text-sm"
              >
                <div className="font-mono text-xs">{o.code}</div>
                <div className="text-xs text-muted-foreground">
                  Agora em {STAGE_LABEL[o.stage] ?? o.stage} · {o.quantity} pç
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {order && (
        <>
          <div className="rounded-xl border border-border bg-card/50 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{order.code}</div>
                <div className="text-lg font-semibold mt-1">{product?.name ?? "Produto —"}</div>
                <div className="text-xs text-muted-foreground">
                  Facção: {supplier?.name ?? "—"} · Qtd: {order.quantity}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Agora em: {STAGE_LABEL[order.stage] ?? order.stage}
                </Badge>
                {currentSince && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                    <Clock className="size-3" /> há {currentSince}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to="/pcp-kanban">
                <Button size="sm" variant="outline">
                  Abrir no Kanban
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-5">
            <h2 className="text-sm font-medium mb-4">Linha do tempo</h2>
            {loadingLogs ? (
              <p className="text-sm text-muted-foreground">Carregando histórico…</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentações registradas ainda.</p>
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-4">
                {logs.map((l) => (
                  <li key={l.id} className="pl-6 relative">
                    <span className="absolute -left-2 top-1.5 size-4 rounded-full bg-primary border-4 border-background" />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {l.from_stage && (
                        <>
                          <span className="text-muted-foreground">
                            {STAGE_LABEL[l.from_stage] ?? l.from_stage}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </>
                      )}
                      <span>{STAGE_LABEL[l.to_stage] ?? l.to_stage}</span>
                      {l.is_partial && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]"
                        >
                          parcial
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Qtd: {l.quantity} · {fmtDate(l.created_at)} · há {relTime(l.created_at)}
                    </div>
                    {l.note && (
                      <div className="text-xs text-muted-foreground italic mt-1">"{l.note}"</div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}
