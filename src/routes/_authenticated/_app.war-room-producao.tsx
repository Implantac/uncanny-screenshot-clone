import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Factory, AlertTriangle, Clock, Truck, Activity, X } from "lucide-react";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/_app/war-room-producao")({
  validateSearch: zodValidator(
    z.object({ productId: fallback(z.string().regex(UUID_RE).optional(), undefined) }),
  ),
  head: () => ({
    meta: [
      { title: "Sala de Guerra · Produção · USE MODA PLM" },
      { name: "description", content: "Visão consolidada de gargalos, OPs críticas e terceirizados." },
    ],
  }),
  component: WarRoomProducao,
});

function WarRoomProducao() {
  const { productId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isLoading } = useQuery({
    queryKey: ["war-room-producao"],
    queryFn: async () => {
      const [ordersR, stagesR, suppliersR] = await Promise.all([
        supabase
          .from("production_orders")
          .select("id, code, stage, status, quantity, due_date, stage_updated_at, outsourced, product_id, products(name, sku), suppliers(name)")
          .neq("status", "cancelada")
          .neq("status", "concluida")
          .limit(500),
        supabase.from("pcp_stages").select("key, label, color, position").eq("active", true).order("position"),
        supabase
          .from("service_orders")
          .select("id, code, supplier_id, quantity, qty_received, sent_at, due_at, status, line_type, suppliers(name)")
          .in("status", ["enviada", "em_andamento"])
          .limit(200),
      ]);
      return {
        orders: ordersR.data ?? [],
        stages: stagesR.data ?? [],
        outsourced: suppliersR.data ?? [],
      };
    },
  });

  const analysis = useMemo(() => {
    const allOrders = data?.orders ?? [];
    const orders = productId ? allOrders.filter((o: any) => o.product_id === productId) : allOrders;
    const stages = data?.stages ?? [];
    const now = Date.now();
    const STUCK = 5 * 86400000;

    const byStage = new Map<string, { qty: number; ops: number }>();
    orders.forEach((o: any) => {
      const cur = byStage.get(o.stage) ?? { qty: 0, ops: 0 };
      cur.qty += o.quantity ?? 0;
      cur.ops += 1;
      byStage.set(o.stage, cur);
    });
    const stageRows = stages.map((s: any) => ({
      ...s,
      qty: byStage.get(s.key)?.qty ?? 0,
      ops: byStage.get(s.key)?.ops ?? 0,
    }));
    const maxQty = Math.max(1, ...stageRows.map((r) => r.qty));
    const bottleneck = [...stageRows].sort((a, b) => b.qty - a.qty)[0];

    const late = orders.filter((o: any) => o.due_date && new Date(o.due_date).getTime() < now);
    const stuck = orders.filter((o: any) => o.stage_updated_at && now - new Date(o.stage_updated_at).getTime() > STUCK);

    const bySupplier = new Map<string, { name: string; pieces: number; ops: number; secondLine: number; oldest: string | null }>();
    (data?.outsourced ?? []).forEach((s: any) => {
      const key = s.supplier_id ?? "—";
      const cur = bySupplier.get(key) ?? { name: s.suppliers?.name ?? "—", pieces: 0, ops: 0, secondLine: 0, oldest: null };
      cur.pieces += (s.quantity ?? 0) - (s.qty_received ?? 0);
      cur.ops += 1;
      if (s.line_type === "segunda_linha") cur.secondLine += 1;
      if (s.sent_at && (!cur.oldest || s.sent_at < cur.oldest)) cur.oldest = s.sent_at;
      bySupplier.set(key, cur);
    });
    const suppliers = [...bySupplier.values()].sort((a, b) => b.pieces - a.pieces);

    const filteredProductName = productId
      ? (allOrders.find((o: any) => o.product_id === productId)?.products?.name ?? null)
      : null;
    return { stageRows, maxQty, bottleneck, late, stuck, suppliers, filteredProductName };
  }, [data, productId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Sala de Guerra</div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Factory className="size-7 text-primary" /> Produção · visão única
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Heatmap de etapas, OPs críticas e terceirizados — com IA explicando o porquê de cada alerta.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><Activity className="size-4 text-primary" /> Heatmap por etapa</div>
              <div className="text-xs text-muted-foreground">Peças em curso por setor — gargalo destacado.</div>
            </div>
            {analysis.bottleneck && (
              <div className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                Gargalo: {analysis.bottleneck.label} ({analysis.bottleneck.qty} pç)
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : (
            <div className="space-y-2.5">
              {analysis.stageRows.map((s) => {
                const pct = (s.qty / analysis.maxQty) * 100;
                const isBottleneck = analysis.bottleneck?.key === s.key && s.qty > 0;
                return (
                  <Link
                    key={s.key}
                    to="/producao-do-dia/$stage"
                    params={{ stage: s.key }}
                    className="block group"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="w-28 truncate group-hover:text-primary">{s.label}</span>
                      <div className="flex-1 h-5 rounded bg-muted overflow-hidden relative">
                        <div
                          className={`h-full ${isBottleneck ? "bg-destructive/80" : "bg-primary/70"} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium">
                          {s.qty} pç · {s.ops} OPs
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {analysis.stageRows.length === 0 && (
                <div className="text-xs text-muted-foreground">Nenhuma OP ativa.</div>
              )}
            </div>
          )}
        </div>

        <AICoordinatorPanel persona="pcp" title="Análise do PCP" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" /> OPs atrasadas
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{analysis.late.length}</span>
          </div>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {analysis.late.slice(0, 12).map((o: any) => (
              <li key={o.id} className="flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{o.code}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.products?.name ?? "—"} · {o.stage}</div>
                </div>
                <div className="text-xs text-destructive whitespace-nowrap">venceu {new Date(o.due_date).toLocaleDateString("pt-BR")}</div>
              </li>
            ))}
            {analysis.late.length === 0 && <li className="text-xs text-success">✓ Nenhuma OP atrasada.</li>}
          </ul>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-warning" /> OPs paradas (5d+)
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{analysis.stuck.length}</span>
          </div>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {analysis.stuck.slice(0, 12).map((o: any) => (
              <li key={o.id} className="flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{o.code}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.products?.name ?? "—"} · {o.stage}</div>
                </div>
                <div className="text-xs text-warning whitespace-nowrap">
                  desde {new Date(o.stage_updated_at).toLocaleDateString("pt-BR")}
                </div>
              </li>
            ))}
            {analysis.stuck.length === 0 && <li className="text-xs text-success">✓ Nada parado por mais de 5 dias.</li>}
          </ul>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Truck className="size-4 text-info" /> Terceirizados — peças em campo
          </div>
          <Link to="/terceirizados" className="text-xs text-primary hover:underline">Abrir gestão →</Link>
        </div>
        {analysis.suppliers.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nada com terceiros no momento.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {analysis.suppliers.slice(0, 9).map((s, i) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.ops} OS · {s.pieces} pç em campo</div>
                {s.secondLine > 0 && <div className="text-[11px] text-orange-500 mt-1">{s.secondLine} OS em 2ª linha</div>}
                {s.oldest && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    OS mais antiga: {new Date(s.oldest).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
