import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listOutsourcedWip } from "@/lib/pcp-ops.functions";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Package, Tags, Boxes, ChevronDown, ChevronRight, AlertTriangle, PackageCheck, Minus } from "lucide-react";
import { toast } from "sonner";

const lineLabel = (line?: string | null) => line === "segunda_linha" ? "2ª linha" : "1ª linha";

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
    (acc: any, s: any) => ({
      pieces: acc.pieces + (s.pieces_at_supplier ?? 0),
      lots: acc.lots + (s.open_lot_count ?? 0),
      refs: acc.refs + (s.distinct_refs ?? 0),
      suppliers: acc.suppliers + 1,
    }),
    { pieces: 0, lots: 0, refs: 0, suppliers: 0 },
  );
  const criticalSuppliers = useMemo(
    () => (data ?? []).filter((s: any) => (s.max_days_at_supplier ?? 0) > 15 || (s.second_line_count ?? 0) > 0).slice(0, 3),
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
          <p className="text-xs text-muted-foreground">O que está em poder de cada facção neste momento — peças, lotes, referências e dias em casa.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Truck} label="Facções com WIP" value={totals.suppliers} />
        <Kpi icon={Package} label="Peças em terceiros" value={totals.pieces.toLocaleString("pt-BR")} />
        <Kpi icon={Boxes} label="Lotes abertos" value={totals.lots} />
        <Kpi icon={Tags} label="Referências distintas" value={totals.refs} />
      </div>

      <div className={`rounded-xl border p-4 ${criticalSuppliers.length ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}>
        <div className="text-sm font-medium">Plano de cobrança</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {criticalSuppliers.length
            ? `Cobrar ${criticalSuppliers.map((s: any) => s.supplier_name ?? String(s.supplier_id).slice(0, 8)).join(", ")}: há peças antigas ou 2ª linha em campo.`
            : "Nenhuma facção crítica agora. Continue acompanhando dias em casa e recebimentos parciais."}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma OS aberta em terceirizados.</div>
        )}
        {data?.map((s: any) => {
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
                  <div className="font-medium truncate">{s.supplier_name ?? s.supplier_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.open_os_count} OS · {s.open_lot_count} lote(s) · {s.distinct_refs} ref(s)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{(s.pieces_at_supplier ?? 0).toLocaleString("pt-BR")}</div>
                  <div className="text-[11px] text-muted-foreground">peças</div>
                </div>
                {(s.second_line_count ?? 0) > 0 && (
                  <div className="text-xs px-2 py-1 rounded border bg-orange-500/10 text-orange-500 border-orange-500/30">
                    {s.second_line_count} OS 2ª linha
                  </div>
                )}
                <div className={`ml-4 text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${lateDays > 15 ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-muted text-muted-foreground border-border"}`}>
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
                      {s.orders.map((o: any) => (
                        <tr key={o.id} className="border-t border-border/50">
                          <td className="py-2 font-mono">{o.code}</td>
                          <td className="py-2">{o.production_orders?.batch_code ?? o.production_orders?.code ?? "—"}</td>
                          <td className="py-2">
                            {o.product_variants
                              ? `${o.product_variants.sku} (${o.product_variants.color}/${o.product_variants.size})`
                              : "—"}
                          </td>
                          <td className="py-2">{o.production_packages?.code ?? "—"}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded border ${o.line_type === "segunda_linha" ? "bg-orange-500/10 text-orange-500 border-orange-500/30" : "bg-muted text-muted-foreground border-border"}`}>{lineLabel(o.line_type)}</span>
                          </td>
                          <td className="py-2 text-muted-foreground">{o.from_stage} → {o.to_stage}</td>
                          <td className="py-2 text-right font-mono">{o.quantity} / {o.qty_received ?? 0}</td>
                          <td className="py-2">{o.sent_at ? new Date(o.sent_at).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="py-2">{o.status}</td>
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
        <Link to="/fornecedores" className="hover:underline">Gerenciar facções →</Link>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1 font-mono">{value}</div>
    </div>
  );
}
