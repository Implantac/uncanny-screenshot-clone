import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Factory, AlertTriangle, Clock, CheckCircle2, Boxes } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/twin-factory")({
  component: TwinFactory,
});

const STAGES = [
  { key: "cad", label: "CAD" },
  { key: "corte", label: "Corte" },
  { key: "costura", label: "Costura" },
  { key: "acabamento", label: "Acabamento" },
  { key: "qualidade", label: "Qualidade" },
  { key: "expedicao", label: "Expedição" },
  { key: "entregue", label: "Entregue" },
];

type Order = {
  id: string; code: string; quantity: number; progress: number;
  status: string; stage: string; due_date: string | null;
  product_id: string | null; batch_code: string | null;
  products: { name: string; sku: string } | null;
};

type Batch = {
  id: string; code: string; name: string | null; status: string;
  planned_quantity: number | null; produced_quantity: number | null;
};

async function loadAll(): Promise<{ orders: Order[]; batches: Batch[] }> {
  const [{ data: orders }, { data: batches }] = await Promise.all([
    supabase.from("production_orders")
      .select("id, code, quantity, progress, status, stage, due_date, product_id, batch_code, products(name, sku)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase.from("production_batches")
      .select("id, code, name, status, planned_quantity, produced_quantity")
      .in("status", ["planejado", "em_producao"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return {
    orders: (orders ?? []) as unknown as Order[],
    batches: (batches ?? []) as unknown as Batch[],
  };
}

function TwinFactory() {
  useRealtime("production_orders", ["twin-factory"]);
  useRealtime("production_batches", ["twin-factory"]);
  const { data, isLoading } = useQuery({ queryKey: ["twin-factory"], queryFn: loadAll });
  const orders = data?.orders ?? [];
  const batches = data?.batches ?? [];

  const today = new Date();
  const stats = useMemo(() => {
    const inProgress = orders.filter((o) => o.stage !== "entregue" && o.status !== "cancelada");
    const delayed = inProgress.filter((o) => o.due_date && new Date(o.due_date) < today);
    const dueSoon = inProgress.filter((o) => o.due_date && new Date(o.due_date) >= today && (new Date(o.due_date).getTime() - today.getTime()) < 7 * 86400000);
    const delivered = orders.filter((o) => o.stage === "entregue").length;
    return { total: orders.length, inProgress: inProgress.length, delayed: delayed.length, dueSoon: dueSoon.length, delivered };
  }, [orders, today]);

  const byStage = useMemo(() => STAGES.map((s) => ({
    ...s,
    items: orders.filter((o) => o.stage === s.key && o.status !== "cancelada"),
  })), [orders]);

  const bottleneck = useMemo(() => {
    const counts = byStage.filter((s) => s.key !== "entregue").map((s) => ({ ...s, count: s.items.reduce((a, i) => a + i.quantity, 0) }));
    return counts.sort((a, b) => b.count - a.count)[0];
  }, [byStage]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Factory className="size-6 text-primary" />Torre de Controle — Twin Factory</h1>
        <p className="text-sm text-muted-foreground">Fluxo PCP em tempo real por setor, com lotes ativos e gargalos.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="OPs ativas" value={stats.inProgress} icon={<Factory className="size-4" />} tone="primary" />
        <Stat label="Atrasadas" value={stats.delayed} icon={<AlertTriangle className="size-4" />} tone="red" />
        <Stat label="Vencem em 7d" value={stats.dueSoon} icon={<Clock className="size-4" />} tone="yellow" />
        <Stat label="Entregues" value={stats.delivered} icon={<CheckCircle2 className="size-4" />} tone="green" />
        <Stat label="Gargalo" value={bottleneck?.label ?? "—"} tone="primary" />
      </div>

      {batches.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2"><Boxes className="size-4 text-primary" />Lotes ativos</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {batches.map((b) => {
              const planned = Number(b.planned_quantity ?? 0);
              const produced = Number(b.produced_quantity ?? 0);
              const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
              return (
                <Link key={b.id} to="/lotes" className="block rounded-lg border border-border bg-muted/30 p-3 hover:border-primary transition-colors">
                  <div className="text-xs font-mono text-muted-foreground">{b.code}</div>
                  <div className="text-sm font-medium truncate">{b.name ?? "—"}</div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{produced}/{planned} pç · {pct}%</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium mb-3">Fluxo por setor (PCP)</div>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {byStage.map((s, idx) => {
            const total = s.items.reduce((a, i) => a + i.quantity, 0);
            const isBottleneck = bottleneck?.key === s.key && s.key !== "entregue" && total > 0;
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
        <div className="px-4 py-3 border-b border-border font-medium">OPs em andamento</div>
        {isLoading ? <div className="p-6 text-muted-foreground">Carregando…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Código</th>
                  <th className="text-left px-3 py-2">Lote</th>
                  <th className="text-left px-3 py-2">Produto</th>
                  <th className="text-left px-3 py-2">Setor</th>
                  <th className="text-right px-3 py-2">Qtd</th>
                  <th className="text-left px-3 py-2 w-48">Progresso</th>
                  <th className="text-left px-3 py-2">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter((o) => o.stage !== "entregue" && o.status !== "cancelada").slice(0, 40).map((o) => {
                  const overdue = o.due_date && new Date(o.due_date) < today;
                  const stage = STAGES.find((s) => s.key === o.stage)?.label ?? o.stage;
                  return (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{o.code}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{o.batch_code ?? "—"}</td>
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
