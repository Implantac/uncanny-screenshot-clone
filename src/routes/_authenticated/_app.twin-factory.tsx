import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  Factory,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Boxes,
  Activity,
  Pause,
  Gauge,
  TrendingUp,
} from "lucide-react";
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
  id: string;
  code: string;
  quantity: number;
  progress: number;
  status: string;
  stage: string;
  due_date: string | null;
  product_id: string | null;
  batch_code: string | null;
  stage_updated_at: string | null;
  products: { name: string; sku: string } | null;
};

type Batch = {
  id: string;
  code: string;
  notes: string | null;
  status: string;
  planned_qty: number | null;
  produced_qty: number | null;
};

type StageLog = { to_stage: string; quantity: number | null; created_at: string };

async function loadAll(): Promise<{ orders: Order[]; batches: Batch[]; logs: StageLog[] }> {
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: orders }, { data: batches }, { data: logs }] = await Promise.all([
    supabase
      .from("production_orders")
      .select(
        "id, code, quantity, progress, status, stage, due_date, product_id, batch_code, stage_updated_at, products(name, sku)",
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from("production_batches")
      .select("id, code, notes, status, planned_qty, produced_qty")
      .in("status", ["planejado", "em_producao"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("production_stage_log")
      .select("to_stage, quantity, created_at")
      .gte("created_at", since7)
      .limit(2000),
  ]);
  return {
    orders: (orders ?? []) as unknown as Order[],
    batches: (batches ?? []) as unknown as Batch[],
    logs: (logs ?? []) as StageLog[],
  };
}

function TwinFactory() {
  useRealtime("production_orders", ["twin-factory"]);
  useRealtime("production_batches", ["twin-factory"]);
  const { data, isLoading } = useQuery({ queryKey: ["twin-factory"], queryFn: loadAll });
  const orders = data?.orders ?? [];
  const batches = data?.batches ?? [];
  const logs = data?.logs ?? [];

  const today = new Date();
  const stats = useMemo(() => {
    const inProgress = orders.filter((o) => o.stage !== "entregue" && o.status !== "cancelada");
    const delayed = inProgress.filter((o) => o.due_date && new Date(o.due_date) < today);
    const dueSoon = inProgress.filter(
      (o) =>
        o.due_date &&
        new Date(o.due_date) >= today &&
        new Date(o.due_date).getTime() - today.getTime() < 7 * 86400000,
    );
    const delivered = orders.filter((o) => o.stage === "entregue").length;
    return {
      total: orders.length,
      inProgress: inProgress.length,
      delayed: delayed.length,
      dueSoon: dueSoon.length,
      delivered,
    };
  }, [orders, today]);

  const byStage = useMemo(
    () =>
      STAGES.map((s) => ({
        ...s,
        items: orders.filter((o) => o.stage === s.key && o.status !== "cancelada"),
      })),
    [orders],
  );

  const bottleneck = useMemo(() => {
    const counts = byStage
      .filter((s) => s.key !== "entregue")
      .map((s) => ({ ...s, count: s.items.reduce((a, i) => a + i.quantity, 0) }));
    return counts.sort((a, b) => b.count - a.count)[0];
  }, [byStage]);

  // === Inteligência adicional (sem nova rota) ===
  const todayKey = today.toISOString().slice(0, 10);
  const intel = useMemo(() => {
    const passToday = logs.filter((l) => l.created_at.slice(0, 10) === todayKey);
    const passWeek = logs;
    const qtyToday = passToday.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const qtyWeek = passWeek.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

    const now = today.getTime();
    const stalled = STAGES.filter((s) => s.key !== "entregue")
      .map((s) => {
        const itemsHere = orders.filter((o) => o.stage === s.key && o.status !== "cancelada");
        if (itemsHere.length === 0) return null;
        const lastMove = itemsHere
          .map((o) => (o.stage_updated_at ? new Date(o.stage_updated_at).getTime() : 0))
          .reduce((a, b) => Math.max(a, b), 0);
        const hoursIdle = lastMove ? Math.floor((now - lastMove) / 3600000) : 9999;
        return { stage: s.label, hoursIdle, count: itemsHere.length };
      })
      .filter(Boolean)
      .filter((x) => x!.hoursIdle >= 48) as { stage: string; hoursIdle: number; count: number }[];

    const planned = batches.reduce((s, b) => s + Number(b.planned_qty ?? 0), 0);
    const produced = batches.reduce((s, b) => s + Number(b.produced_qty ?? 0), 0);
    const efficiency = planned > 0 ? Math.round((produced / planned) * 100) : 0;

    return { qtyToday, qtyWeek, stalled, efficiency, passCountToday: passToday.length };
  }, [logs, orders, batches, today, todayKey]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Factory className="size-6 text-primary" />
          Torre de Controle — Twin Factory
        </h1>
        <p className="text-sm text-muted-foreground">
          Fluxo PCP em tempo real por setor, com lotes ativos e gargalos.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat
          label="OPs ativas"
          value={stats.inProgress}
          icon={<Factory className="size-4" />}
          tone="primary"
        />
        <Stat
          label="Atrasadas"
          value={stats.delayed}
          icon={<AlertTriangle className="size-4" />}
          tone="red"
        />
        <Stat
          label="Vencem em 7d"
          value={stats.dueSoon}
          icon={<Clock className="size-4" />}
          tone="yellow"
        />
        <Stat
          label="Entregues"
          value={stats.delivered}
          icon={<CheckCircle2 className="size-4" />}
          tone="green"
        />
        <Stat label="Gargalo" value={bottleneck?.label ?? "—"} tone="primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Activity className="size-4" /> Produção
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div>
              <div className="text-2xl font-semibold">{intel.qtyToday.toLocaleString("pt-BR")}</div>
              <div className="text-[11px] text-muted-foreground">
                peças hoje · {intel.passCountToday} passagens
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm font-medium flex items-center gap-1 justify-end">
                <TrendingUp className="size-3" />
                {intel.qtyWeek.toLocaleString("pt-BR")}
              </div>
              <div className="text-[11px] text-muted-foreground">últimos 7 dias</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Gauge className="size-4" /> Eficiência (lotes ativos)
          </div>
          <div className="mt-2 text-2xl font-semibold">{intel.efficiency}%</div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${intel.efficiency >= 80 ? "bg-success" : intel.efficiency >= 50 ? "bg-warning" : "bg-destructive"}`}
              style={{ width: `${intel.efficiency}%` }}
            />
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${intel.stalled.length > 0 ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Pause className="size-4" /> Setores parados (≥48h)
          </div>
          {intel.stalled.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">Nenhum setor parado.</div>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {intel.stalled.slice(0, 4).map((s) => (
                <li key={s.stage} className="flex justify-between">
                  <span>
                    {s.stage} <span className="text-xs text-muted-foreground">({s.count} OPs)</span>
                  </span>
                  <span className="font-semibold text-warning">{s.hoursIdle}h</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {batches.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <Boxes className="size-4 text-primary" />
            Lotes ativos
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {batches.map((b) => {
              const planned = Number(b.planned_qty ?? 0);
              const produced = Number(b.produced_qty ?? 0);
              const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
              return (
                <Link
                  key={b.id}
                  to="/lotes"
                  className="block rounded-lg border border-border bg-muted/30 p-3 hover:border-primary transition-colors"
                >
                  <div className="text-xs font-mono text-muted-foreground">{b.code}</div>
                  <div className="text-sm font-medium truncate">{b.notes ?? "Lote ativo"}</div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {produced}/{planned} pç · {pct}%
                  </div>
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
                <div
                  className={`min-w-[140px] rounded-lg border p-3 ${isBottleneck ? "border-warning bg-warning/10" : "border-border bg-muted/30"}`}
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
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
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Carregando…</div>
        ) : (
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
                {orders
                  .filter((o) => o.stage !== "entregue" && o.status !== "cancelada")
                  .slice(0, 40)
                  .map((o) => {
                    const overdue = o.due_date && new Date(o.due_date) < today;
                    const stage = STAGES.find((s) => s.key === o.stage)?.label ?? o.stage;
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{o.code}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {o.batch_code ?? "—"}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[200px]">
                          {o.products?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-muted text-xs">{stage}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{o.quantity}</td>
                        <td className="px-3 py-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, o.progress)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {o.progress}%
                          </div>
                        </td>
                        <td
                          className={`px-3 py-2 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
                        >
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

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone: "red" | "yellow" | "green" | "primary";
}) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 bg-card ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
