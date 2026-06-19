import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Activity,
  Radio,
  Factory,
  Rocket,
  Bell,
  Gauge,
  Brain,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { WarRoomPanel } from "@/components/war-room-panel";
import { AutoPushSentinel } from "@/components/auto-push-sentinel";

export const Route = createFileRoute("/_authenticated/_app/control-tower")({
  component: ControlTower,
});

const GRADES = ["PP", "P", "M", "G", "GG", "XG", "XXG"];
const DEFAULT_MIX: Record<string, number> = {
  PP: 0.08,
  P: 0.18,
  M: 0.32,
  G: 0.24,
  GG: 0.12,
  XG: 0.04,
  XXG: 0.02,
};

type Row = {
  product_id: string;
  sku: string;
  name: string;
  collection: string | null;
  stock: number;
  minimum: number;
  sold30: number;
  pending: number;
  producing: number;
  coverage: number;
  need: number;
  status: "red" | "yellow" | "green";
  byGrade: Record<string, number>;
};

async function loadDemand(): Promise<Row[]> {
  const [{ data: products }, { data: sales }, { data: inv }, { data: orders }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, sizes, collection_id, collections(name)")
      .limit(500),
    supabase
      .from("sales")
      .select("product_id, sku, quantity, sold_at")
      .gte("sold_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("inventory_items").select("sku, balance, minimum"),
    supabase.from("production_orders").select("product_id, quantity, status"),
  ]);

  const invBySku = new Map((inv ?? []).map((i) => [i.sku, i]));
  const soldByProd = new Map<string, number>();
  (sales ?? []).forEach((s) => {
    if (s.product_id)
      soldByProd.set(s.product_id, (soldByProd.get(s.product_id) ?? 0) + s.quantity);
  });
  const prodByProd = new Map<string, number>();
  (orders ?? []).forEach((o) => {
    if (o.product_id && o.status !== "concluida" && o.status !== "cancelada") {
      prodByProd.set(o.product_id, (prodByProd.get(o.product_id) ?? 0) + (o.quantity ?? 0));
    }
  });

  return (products ?? [])
    .map((p: any) => {
      const invItem = invBySku.get(p.sku);
      const stock = Number(invItem?.balance ?? 0);
      const minimum = Number(invItem?.minimum ?? 0);
      const sold30 = soldByProd.get(p.id) ?? 0;
      const producing = prodByProd.get(p.id) ?? 0;
      const dailyAvg = sold30 / 30;
      const coverage = dailyAvg > 0 ? Math.floor(stock / dailyAvg) : 999;
      const target = Math.max(minimum * 2, Math.ceil(dailyAvg * 45));
      const need = Math.max(0, target - stock - producing);
      const status: Row["status"] = coverage < 7 ? "red" : coverage < 21 ? "yellow" : "green";
      const sizes = (p.sizes ?? []) as string[];
      const activeGrades = sizes.length > 0 ? sizes.filter((s) => GRADES.includes(s)) : GRADES;
      const totalWeight = activeGrades.reduce((a, g) => a + (DEFAULT_MIX[g] ?? 0.1), 0);
      const byGrade: Record<string, number> = {};
      activeGrades.forEach((g) => {
        byGrade[g] = Math.round((need * (DEFAULT_MIX[g] ?? 0.1)) / totalWeight);
      });
      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        collection: p.collections?.name ?? null,
        stock,
        minimum,
        sold30,
        pending: 0,
        producing,
        coverage,
        need,
        status,
        byGrade,
      };
    })
    .sort((a, b) => b.need - a.need);
}

type StageStat = {
  stage: string;
  wip: number;
  pieces: number;
  late: number;
  avgHours: number;
  throughput7d: number;
};

async function loadLive(): Promise<{ stages: StageStat[]; lateOrders: any[]; recent: any[] }> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: orders }, { data: log }] = await Promise.all([
    supabase
      .from("production_orders")
      .select("id, code, stage, quantity, due_date, stage_updated_at, priority, products(name)")
      .neq("status", "concluida")
      .neq("status", "cancelada"),
    supabase
      .from("production_stage_log")
      .select("to_stage, created_at, quantity, order_id, from_stage")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const byStage = new Map<string, StageStat>();
  for (const o of orders ?? []) {
    const s = o.stage ?? "—";
    if (!byStage.has(s))
      byStage.set(s, { stage: s, wip: 0, pieces: 0, late: 0, avgHours: 0, throughput7d: 0 });
    const st = byStage.get(s)!;
    st.wip += 1;
    st.pieces += o.quantity ?? 0;
    if (o.due_date && o.due_date < today) st.late += 1;
    const h = (Date.now() - new Date(o.stage_updated_at).getTime()) / 3600000;
    st.avgHours += h;
  }
  byStage.forEach((s) => {
    s.avgHours = s.wip > 0 ? Math.round(s.avgHours / s.wip) : 0;
  });
  for (const l of log ?? []) {
    const s = l.to_stage;
    if (!byStage.has(s))
      byStage.set(s, { stage: s, wip: 0, pieces: 0, late: 0, avgHours: 0, throughput7d: 0 });
    byStage.get(s)!.throughput7d += l.quantity ?? 0;
  }

  const lateOrders = (orders ?? [])
    .filter((o) => o.due_date && o.due_date < today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 10);

  return { stages: Array.from(byStage.values()), lateOrders, recent: (log ?? []).slice(0, 15) };
}

function ControlTower() {
  const [tab, setTab] = useState<"live" | "demand">("live");
  useRealtime("production_orders", ["control-tower-live"]);
  useRealtime("production_stage_log", ["control-tower-live"]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Torre de Controle</h1>
          <p className="text-sm text-muted-foreground">
            Operação ao vivo do chão de fábrica + previsão de demanda.
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setTab("live")}
            className={`px-3 py-1.5 rounded inline-flex items-center gap-1.5 ${tab === "live" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Radio className="size-3" /> Operação ao vivo
          </button>
          <button
            onClick={() => setTab("demand")}
            className={`px-3 py-1.5 rounded inline-flex items-center gap-1.5 ${tab === "demand" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Activity className="size-3" /> Demanda × Suprimento
          </button>
        </div>
      </header>

      <div className="flex justify-end">
        <AutoPushSentinel />
      </div>

      <WarRoomPanel />

      {tab === "live" ? <LiveTab /> : <DemandTab />}
    </div>
  );
}

function LiveTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["control-tower-live"],
    queryFn: loadLive,
    refetchInterval: 30_000,
  });
  const stages = data?.stages ?? [];
  const totalWip = stages.reduce((a, s) => a + s.wip, 0);
  const totalPieces = stages.reduce((a, s) => a + s.pieces, 0);
  const totalLate = stages.reduce((a, s) => a + s.late, 0);
  const throughput = stages.reduce((a, s) => a + s.throughput7d, 0);
  const bottleneck = [...stages].sort((a, b) => b.avgHours - a.avgHours)[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          label="OPs em produção"
          value={totalWip}
          icon={<Factory className="size-4" />}
          tone="primary"
        />
        <Card
          label="Peças em WIP"
          value={totalPieces.toLocaleString("pt-BR")}
          icon={<Activity className="size-4" />}
          tone="primary"
        />
        <Card
          label="OPs atrasadas"
          value={totalLate}
          icon={<AlertTriangle className="size-4" />}
          tone="red"
        />
        <Card
          label="Throughput 7d (pç)"
          value={throughput.toLocaleString("pt-BR")}
          icon={<CheckCircle2 className="size-4" />}
          tone="green"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Setores</h2>
          {bottleneck && bottleneck.avgHours > 24 && (
            <span className="text-xs px-2 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 inline-flex items-center gap-1">
              <AlertTriangle className="size-3" /> Gargalo:{" "}
              <strong className="capitalize">{bottleneck.stage}</strong> ({bottleneck.avgHours}h
              médias)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {isLoading && (
            <div className="col-span-full text-sm text-muted-foreground">Carregando…</div>
          )}
          {!isLoading && stages.length === 0 && (
            <div className="col-span-full text-sm text-muted-foreground">Sem OPs ativas.</div>
          )}
          {stages.map((s) => {
            const isJam = s.avgHours > 48;
            const isLate = s.late > 0;
            return (
              <div
                key={s.stage}
                className={`rounded-xl border bg-card p-4 ${isJam ? "border-destructive/40" : isLate ? "border-orange-500/40" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold capitalize">{s.stage}</div>
                  <span
                    className={`size-2 rounded-full ${isJam ? "bg-destructive" : isLate ? "bg-orange-500" : "bg-success"}`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Stat label="OPs" value={s.wip} />
                  <Stat label="Peças" value={s.pieces.toLocaleString("pt-BR")} />
                  <Stat
                    label="Atrasadas"
                    value={s.late}
                    tone={s.late > 0 ? "destructive" : "default"}
                  />
                  <Stat
                    label="Tempo médio"
                    value={s.avgHours < 24 ? `${s.avgHours}h` : `${Math.floor(s.avgHours / 24)}d`}
                  />
                  <Stat
                    label="Throughput 7d"
                    value={s.throughput7d.toLocaleString("pt-BR")}
                    tone="primary"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-semibold inline-flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> Top atrasadas
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-1.5">OP</th>
                <th className="text-left px-3 py-1.5">Produto</th>
                <th className="text-left px-3 py-1.5">Setor</th>
                <th className="text-right px-3 py-1.5">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {(data?.lateOrders ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted-foreground">
                    Nenhuma OP atrasada 🎉
                  </td>
                </tr>
              )}
              {(data?.lateOrders ?? []).map((o: any) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{o.code}</td>
                  <td className="px-3 py-1.5 truncate max-w-[160px]">{o.products?.name ?? "—"}</td>
                  <td className="px-3 py-1.5 capitalize">{o.stage}</td>
                  <td className="px-3 py-1.5 text-right text-destructive">{o.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-semibold inline-flex items-center gap-2">
            <Activity className="size-4 text-primary" /> Últimas passagens
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-1.5">Quando</th>
                <th className="text-left px-3 py-1.5">De → Para</th>
                <th className="text-right px-3 py-1.5">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted-foreground">
                    Sem movimentações em 7d.
                  </td>
                </tr>
              )}
              {(data?.recent ?? []).map((l: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-1.5 capitalize">
                    {l.from_stage ?? "—"} → <strong>{l.to_stage}</strong>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.quantity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DemandTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["control-tower-demand"],
    queryFn: loadDemand,
  });
  const summary = useMemo(
    () => ({
      red: rows.filter((r) => r.status === "red").length,
      yellow: rows.filter((r) => r.status === "yellow").length,
      green: rows.filter((r) => r.status === "green").length,
      totalNeed: rows.reduce((a, r) => a + r.need, 0),
    }),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          label="Produção urgente"
          value={summary.red}
          icon={<AlertTriangle className="size-4" />}
          tone="red"
        />
        <Card
          label="Atenção"
          value={summary.yellow}
          icon={<AlertCircle className="size-4" />}
          tone="yellow"
        />
        <Card
          label="Saudável"
          value={summary.green}
          icon={<CheckCircle2 className="size-4" />}
          tone="green"
        />
        <Card
          label="Peças a produzir"
          value={summary.totalNeed.toLocaleString("pt-BR")}
          tone="primary"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2">Estoque</th>
                <th className="text-right px-3 py-2">Mín</th>
                <th className="text-right px-3 py-2">Vendido 30d</th>
                <th className="text-right px-3 py-2">Produzindo</th>
                <th className="text-right px-3 py-2">Cobertura</th>
                <th className="text-right px-3 py-2">Necessidade</th>
                {GRADES.map((g) => (
                  <th key={g} className="text-right px-2 py-2">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-muted-foreground">
                    Sem produtos cadastrados.
                  </td>
                </tr>
              )}
              {rows.slice(0, 100).map((r) => (
                <tr key={r.product_id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block size-2.5 rounded-full ${r.status === "red" ? "bg-destructive" : r.status === "yellow" ? "bg-warning" : "bg-success"}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]">
                    {r.name}
                    <div className="text-[10px] text-muted-foreground">{r.collection ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.stock}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.minimum}</td>
                  <td className="px-3 py-2 text-right">{r.sold30}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.producing}</td>
                  <td className="px-3 py-2 text-right">
                    {r.coverage > 365 ? "∞" : `${r.coverage}d`}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{r.need}</td>
                  {GRADES.map((g) => (
                    <td key={g} className="px-2 py-2 text-right text-xs text-muted-foreground">
                      {r.byGrade[g] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({
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

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "destructive";
}) {
  const cls =
    tone === "primary"
      ? "text-primary"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
