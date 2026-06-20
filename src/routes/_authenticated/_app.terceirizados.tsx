import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOutsourcedWip } from "@/lib/pcp-ops.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  Package,
  Tags,
  Boxes,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  PackageCheck,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

type Supplier = NonNullable<Awaited<ReturnType<typeof listOutsourcedWip>>>[number] & {
  open_os_count?: number;
  open_lot_count?: number;
  distinct_refs?: number;
  max_days_at_supplier?: number;
  owner_id?: string;
};
type OrderRow = Supplier["orders"][number];

const lineLabel = (line?: string | null) => (line === "segunda_linha" ? "2ª linha" : "1ª linha");

export const Route = createFileRoute("/_authenticated/_app/terceirizados")({
  head: () => ({ meta: [{ title: "Terceirizados · USE MODA OS" }] }),
  component: OutsourcedPage,
});

function OutsourcedPage() {
  const fetchWip = useServerFn(listOutsourcedWip);
  const { data, isLoading } = useQuery({
    queryKey: ["outsourced-wip"],
    queryFn: () => fetchWip(),
    refetchInterval: 60_000,
  });
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const totals = (data ?? []).reduce(
    (acc: { pieces: number; lots: number; refs: number; suppliers: number }, s: Supplier) => ({
      pieces: acc.pieces + (s.pieces_at_supplier ?? 0),
      lots: acc.lots + (s.open_lot_count ?? 0),
      refs: acc.refs + (s.distinct_refs ?? 0),
      suppliers: acc.suppliers + 1,
    }),
    { pieces: 0, lots: 0, refs: 0, suppliers: 0 },
  );
  const criticalSuppliers = useMemo(
    () =>
      (data ?? [])
        .filter((s: Supplier) => (s.max_days_at_supplier ?? 0) > 15 || (s.second_line_count ?? 0) > 0)
        .slice(0, 3),
    [data],
  );

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Truck className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Terceirizados</h1>
          <p className="text-xs text-muted-foreground">
            O que está em poder de cada facção neste momento — peças, lotes, referências e dias em
            casa.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Truck} label="Facções com WIP" value={totals.suppliers} />
        <Kpi
          icon={Package}
          label="Peças em terceiros"
          value={totals.pieces.toLocaleString("pt-BR")}
        />
        <Kpi icon={Boxes} label="Lotes abertos" value={totals.lots} />
        <Kpi icon={Tags} label="Referências distintas" value={totals.refs} />
      </div>

      <div
        className={`rounded-xl border p-4 ${criticalSuppliers.length ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}
      >
        <div className="text-sm font-medium">Plano de cobrança</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {criticalSuppliers.length
            ? `Cobrar ${criticalSuppliers.map((s: Supplier) => s.supplier_name ?? String(s.supplier_id).slice(0, 8)).join(", ")}: há peças antigas ou 2ª linha em campo.`
            : "Nenhuma facção crítica agora. Continue acompanhando dias em casa e recebimentos parciais."}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        )}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma OS aberta em terceirizados.
          </div>
        )}
        {data?.map((s: Supplier) => {
          const isOpen = !!open[s.supplier_id];
          const lateDays = s.max_days_at_supplier ?? 0;
          return (
            <div key={s.supplier_id} className="border-b border-border last:border-0">
              <button
                onClick={() => setOpen((o) => ({ ...o, [s.supplier_id]: !o[s.supplier_id] }))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 text-left"
              >
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {s.supplier_name ?? s.supplier_id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.open_os_count} OS · {s.open_lot_count} lote(s) · {s.distinct_refs} ref(s)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">
                    {(s.pieces_at_supplier ?? 0).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">peças</div>
                </div>
                {(s.second_line_count ?? 0) > 0 && (
                  <div className="text-xs px-2 py-1 rounded border bg-orange-500/10 text-orange-500 border-orange-500/30">
                    {s.second_line_count} OS 2ª linha
                  </div>
                )}
                <div
                  className={`ml-4 text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${lateDays > 15 ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-muted text-muted-foreground border-border"}`}
                >
                  {lateDays > 15 && <AlertTriangle className="size-3" />}
                  {lateDays}d máx
                </div>
              </button>

              {isOpen && (
                <div className="bg-muted/10 px-4 py-2">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left py-2">OS</th>
                        <th className="text-left py-2">Lote</th>
                        <th className="text-left py-2">Referência</th>
                        <th className="text-left py-2">Pacote</th>
                        <th className="text-left py-2">Linha</th>
                        <th className="text-left py-2">Etapa</th>
                        <th className="text-right py-2">Qtd / Recebida</th>
                        <th className="text-left py-2">Enviado em</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-right py-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.orders.map((o: OrderRow) => (
                        <tr key={o.id} className="border-t border-border/50">
                          <td className="py-2 font-mono">{o.code}</td>
                          <td className="py-2">
                            {o.production_orders?.batch_code ?? o.production_orders?.code ?? "—"}
                          </td>
                          <td className="py-2">
                            {o.product_variants
                              ? `${o.product_variants.sku} (${o.product_variants.color}/${o.product_variants.size})`
                              : "—"}
                          </td>
                          <td className="py-2">{o.production_packages?.code ?? "—"}</td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded border ${o.line_type === "segunda_linha" ? "bg-orange-500/10 text-orange-500 border-orange-500/30" : "bg-muted text-muted-foreground border-border"}`}
                            >
                              {lineLabel(o.line_type)}
                            </span>
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {o.from_stage} → {o.to_stage}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {o.quantity} / {o.qty_received ?? 0}
                          </td>
                          <td className="py-2">
                            {o.sent_at ? new Date(o.sent_at).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="py-2">{o.status}</td>
                          <td className="py-2 text-right">
                            <ReturnButton os={{ ...o, owner_id: s.owner_id }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground">
        <Link to="/fornecedores" className="hover:underline">
          Gerenciar facções →
        </Link>
      </div>
    </div>
  );
}

function ReturnButton({ os }: { os: OrderRow & { owner_id?: string; notes?: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const sent = Number(os.quantity ?? 0);
  const received = Number(os.qty_received ?? 0);
  const pending = Math.max(0, sent - received);
  const [qty, setQty] = useState<number>(pending);
  const [loss, setLoss] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (qty <= 0) throw new Error("Quantidade a receber deve ser maior que zero");
      if (qty > pending) throw new Error("Quantidade maior que o saldo pendente");
      const totalReceived = received + qty;
      const kind = totalReceived >= sent ? "integral" : "parcial";
      const { data: u } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("service_orders")
        .update({
          qty_received: totalReceived,
          status: "recebida",
          received_at: new Date().toISOString(),
          kind,
          notes: notes ? `${os.notes ? os.notes + "\n" : ""}Retorno: ${notes}` : os.notes,
        })
        .eq("id", os.id);
      if (error) throw error;

      if (loss > 0 && os.production_order_id && os.owner_id) {
        await supabase.from("production_occurrences").insert({
          owner_id: os.owner_id,
          order_id: os.production_order_id,
          kind: "negativa",
          sector: os.to_stage,
          responsible_id: u.user?.id ?? null,
          affected_qty: loss,
          status: "aberta",
          description: `Perda no retorno do terceirizado (OS ${os.code})${notes ? " — " + notes : ""}`,
        });
      }
      return { kind };
    },
    onSuccess: ({ kind }) => {
      toast.success(`Retorno ${kind} registrado`);
      qc.invalidateQueries({ queryKey: ["outsourced-wip"] });
      qc.invalidateQueries({ queryKey: ["pcp-kanban"] });
      qc.invalidateQueries({ queryKey: ["lote-occ"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (pending <= 0) return <span className="text-[10px] text-muted-foreground">recebido</span>;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition"
      >
        <PackageCheck className="size-3" /> Registrar retorno
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-popover shadow-lg p-3 space-y-2 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-semibold">Retorno do terceirizado</div>
            <div className="text-[10px] text-muted-foreground">
              Enviado {sent} · Recebido {received} · Pendente <strong>{pending}</strong>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setQty(pending)}
                className={`flex-1 text-[10px] py-1 rounded border ${qty === pending ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
              >
                Integral ({pending})
              </button>
              <button
                type="button"
                onClick={() => setQty(Math.max(1, Math.floor(pending / 2)))}
                className={`flex-1 text-[10px] py-1 rounded border ${qty !== pending && qty > 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "border-border hover:bg-muted"}`}
              >
                Parcial
              </button>
            </div>
            <label className="block text-[10px] text-muted-foreground">
              Quantidade recebida agora
              <input
                type="number"
                min={1}
                max={pending}
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, Math.min(pending, Number(e.target.value) || 0)))
                }
                className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1"
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Minus className="size-3" />
                Perda no retorno (opcional)
              </span>
              <input
                type="number"
                min={0}
                value={loss}
                onChange={(e) => setLoss(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1"
              />
              <span className="text-[9px] text-muted-foreground">
                Gera ocorrência negativa na OP.
              </span>
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Observação
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: 5 peças manchadas…"
                className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => submit.mutate()}
                disabled={submit.isPending}
                className="flex-1 text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submit.isPending ? "Salvando…" : "Confirmar retorno"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1.5 rounded border border-border hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1 font-mono">{value}</div>
    </div>
  );
}
