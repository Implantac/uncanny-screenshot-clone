import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Factory, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/twin-factory")({
  component: TwinFactory,
});

const STAGES = [
  { key: "aguardando", label: "Aguardando" },
  { key: "em_producao", label: "Em produção" },
  { key: "atrasada", label: "Atrasada" },
  { key: "concluida", label: "Concluída" },
  { key: "cancelada", label: "Cancelada" },
];

type Order = {
  id: string; code: string; quantity: number; progress: number;
  status: string; due_date: string | null; product_id: string | null;
  products: { name: string; sku: string } | null;
};

async function loadOrders(): Promise<Order[]> {
  const { data } = await supabase.from("production_orders")
    .select("id, code, quantity, progress, status, due_date, product_id, products(name, sku)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  return (data ?? []) as unknown as Order[];
}

function TwinFactory() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["twin-factory"], queryFn: loadOrders, refetchInterval: 15000,
  });

  const today = new Date();
  const stats = useMemo(() => {
    const inProgress = orders.filter((o) => o.status !== "concluido" && o.status !== "cancelado");
    const delayed = inProgress.filter((o) => o.due_date && new Date(o.due_date) < today);
    const dueSoon = inProgress.filter((o) => o.due_date && new Date(o.due_date) >= today && (new Date(o.due_date).getTime() - today.getTime()) < 7 * 86400000);
    const completed = orders.filter((o) => o.status === "concluido").length;
    return { total: orders.length, inProgress: inProgress.length, delayed: delayed.length, dueSoon: dueSoon.length, completed };
  }, [orders, today]);

  const byStage = useMemo(() => STAGES.map((s) => ({
    ...s,
    items: orders.filter((o) => o.status === s.key),
  })), [orders]);

  const bottleneck = useMemo(() => {
    const counts = byStage.filter((s) => s.key !== "concluido").map((s) => ({ ...s, count: s.items.reduce((a, i) => a + i.quantity, 0) }));
    return counts.sort((a, b) => b.count - a.count)[0];
  }, [byStage]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Factory className="size-6 text-primary" />Digital Twin Factory</h1>
        <p className="text-sm text-muted-foreground">Torre de controle da produção em tempo real (atualiza a cada 15s).</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Lotes ativos" value={stats.inProgress} icon={<Factory className="size-4" />} tone="primary" />
        <Stat label="Atrasados" value={stats.delayed} icon={<AlertTriangle className="size-4" />} tone="red" />
        <Stat label="Vencem em 7d" value={stats.dueSoon} icon={<Clock className="size-4" />} tone="yellow" />
        <Stat label="Concluídos" value={stats.completed} icon={<CheckCircle2 className="size-4" />} tone="green" />
        <Stat label="Gargalo" value={bottleneck?.label ?? "—"} tone="primary" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium mb-3">Fluxo de produção</div>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {byStage.map((s, idx) => {
            const total = s.items.reduce((a, i) => a + i.quantity, 0);
            const isBottleneck = bottleneck?.key === s.key && s.key !== "concluido" && total > 0;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`min-w-[140px] rounded-lg border p-3 ${isBottleneck ? "border-warning bg-warning/10" : "border-border bg-muted/30"}`}>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{s.items.length}</div>
                  <div className="text-[11px] text-muted-foreground">{total} pç</div>
                </div>
                {idx < STAGES.length - 1 && <div className="text-muted-foreground">→</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border font-medium">Lotes em andamento</div>
        {isLoading ? <div className="p-6 text-muted-foreground">Carregando…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Código</th>
                  <th className="text-left px-3 py-2">Produto</th>
                  <th className="text-left px-3 py-2">Setor</th>
                  <th className="text-right px-3 py-2">Qtd</th>
                  <th className="text-left px-3 py-2 w-48">Progresso</th>
                  <th className="text-left px-3 py-2">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter((o) => o.status !== "concluido" && o.status !== "cancelado").slice(0, 30).map((o) => {
                  const overdue = o.due_date && new Date(o.due_date) < today;
                  const stage = STAGES.find((s) => s.key === o.status)?.label ?? o.status;
                  return (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{o.code}</td>
                      <td className="px-3 py-2 truncate max-w-[200px]">{o.products?.name ?? "—"}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 rounded bg-muted text-xs">{stage}</span></td>
                      <td className="px-3 py-2 text-right">{o.quantity}</td>
                      <td className="px-3 py-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, o.progress)}%` }} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{o.progress}%</div>
                      </td>
                      <td className={`px-3 py-2 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {o.due_date ? new Date(o.due_date).toLocaleDateString("pt-BR") : "—"}
                        {overdue && " ⚠"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number | string; icon?: React.ReactNode; tone: "red" | "yellow" | "green" | "primary" }) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 bg-card ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
