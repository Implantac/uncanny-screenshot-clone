import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, MapPin, Loader2, Package, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { getOrderTimeline } from "@/lib/traceability.functions";

export const Route = createFileRoute("/_authenticated/_app/onde-esta")({
  head: () => ({
    meta: [
      { title: "Onde está? · Rastreabilidade · USE MODA PLM" },
      { name: "description", content: "Rastreie qualquer OP ou lote: por onde passou, quando e quanto." },
    ],
  }),
  component: OndeEsta,
});

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

function OndeEsta() {
  const fn = useServerFn(getOrderTimeline);
  const [q, setQ] = useState("");
  const mutation = useMutation({ mutationFn: (query: string) => fn({ data: { query } }) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) mutation.mutate(q.trim());
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Rastreabilidade</div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <MapPin className="size-7 text-primary" /> Onde está?
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Digite o código da OP ou do lote para ver toda a passagem por setores, parcial ou integral.
        </p>
      </div>

      <form onSubmit={submit} className="glass rounded-xl p-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: OP-20251202-ABC123 ou LOTE-..."
            className="w-full pl-9 pr-3 py-2 bg-transparent rounded-lg border border-border focus:border-primary outline-none text-sm"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || q.trim().length < 2}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Rastrear
        </button>
      </form>

      {mutation.error && (
        <div className="glass rounded-xl p-4 text-sm text-destructive">{(mutation.error as Error).message}</div>
      )}

      {mutation.data && mutation.data.orders.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
          Nada encontrado para <span className="font-mono">{q}</span>.
        </div>
      )}

      {mutation.data && mutation.data.orders.length > 0 && (
        <div className="space-y-5">
          {mutation.data.orders.map((o: any) => {
            const evts = mutation.data.events.filter((e: any) => e.order_id === o.id);
            const last = evts[evts.length - 1];
            const here = last ? `Atualmente em ${last.to_stage}` : `Atualmente em ${o.stage}`;
            const since = last?.created_at ?? o.stage_updated_at ?? o.created_at;
            return (
              <div key={o.id} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    {o.products?.image_url && (
                      <img src={o.products.image_url} alt="" className="size-12 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{o.code}</div>
                      <div className="text-sm font-medium truncate">{o.products?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        SKU {o.products?.sku ?? "—"} · {o.quantity} pç
                        {o.batch_code && <> · lote <span className="font-mono">{o.batch_code}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Package className="size-3" /> {here}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Clock className="size-3" /> há {relTime(since)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-l border-border ml-4 pl-5 space-y-4">
                  {evts.length === 0 ? (
                    <div className="text-xs text-muted-foreground -ml-9">
                      <span className="inline-block size-2 rounded-full bg-muted-foreground mr-2" />
                      Sem movimentos ainda. Etapa atual: <span className="font-medium">{o.stage}</span>.
                    </div>
                  ) : (
                    evts.map((e: any, idx: number) => (
                      <div key={e.id} className="relative">
                        <span className={`absolute -left-[27px] top-1 size-2.5 rounded-full ${idx === evts.length - 1 ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground"}`} />
                        <div className="flex items-center gap-2 text-sm">
                          {e.from_stage && (
                            <>
                              <span className="text-muted-foreground">{e.from_stage}</span>
                              <ArrowRight className="size-3 text-muted-foreground" />
                            </>
                          )}
                          <span className="font-medium">{e.to_stage}</span>
                          <span className="text-xs text-muted-foreground">· {e.quantity} pç</span>
                          {e.is_partial ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">parcial</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium inline-flex items-center gap-1">
                              <CheckCircle2 className="size-2.5" /> integral
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(e.created_at).toLocaleString("pt-BR")} · há {relTime(e.created_at)}
                        </div>
                        {e.note && <div className="text-xs text-muted-foreground mt-1 italic">"{e.note}"</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
