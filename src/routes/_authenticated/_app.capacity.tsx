import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Factory, Clock, CheckCircle2, AlertTriangle, Gauge, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/capacity")({
  component: Capacity,
});

type Order = {
  id: string;
  code: string;
  status: string;
  quantity: number;
  progress: number;
  due_date: string | null;
  supplier_id: string | null;
  supplier?: string | null;
};

async function load() {
  const [{ data: orders }, { data: suppliers }] = await Promise.all([
    supabase.from("production_orders").select("id, code, status, quantity, progress, due_date, supplier_id, suppliers(name)").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("suppliers").select("id, name"),
  ]);
  return {
    orders: (orders ?? []).map((o) => ({ ...o, supplier: (o.suppliers as { name?: string } | null)?.name ?? null })) as Order[],
    suppliers: suppliers ?? [],
  };
}

function Capacity() {
  const { data, isLoading } = useQuery({ queryKey: ["capacity"], queryFn: load });
  const orders = data?.orders ?? [];
  const today = Date.now();

  const summary = useMemo(() => {
    const active = orders.filter((o) => o.status !== "concluida" && o.status !== "cancelada");
    const wip = active.reduce((s, o) => s + o.quantity, 0);
    const produced = orders.reduce((s, o) => s + Math.round((o.quantity * o.progress) / 100), 0);
    const planned = orders.reduce((s, o) => s + o.quantity, 0);
    const oee = planned > 0 ? (produced / planned) * 100 : 0;
    const late = active.filter((o) => o.due_date && new Date(o.due_date).getTime() < today).length;
    return { wip, planned, produced, oee, late, active: active.length };
  }, [orders]);

  const bySupplier = useMemo(() => {
    const m = new Map<string, { name: string; orders: number; qty: number; progress: number; late: number }>();
    orders.forEach((o) => {
      const key = o.supplier ?? "Sem fornecedor";
      const c = m.get(key) ?? { name: key, orders: 0, qty: 0, progress: 0, late: 0 };
      c.orders += 1;
      c.qty += o.quantity;
      c.progress += o.progress;
      if (o.due_date && new Date(o.due_date).getTime() < today && o.status !== "concluida") c.late += 1;
      m.set(key, c);
    });
    return Array.from(m.values()).map((s) => ({ ...s, avgProgress: s.orders > 0 ? s.progress / s.orders : 0 })).sort((a, b) => b.qty - a.qty);
  }, [orders, today]);

  const overloaded = bySupplier.filter((s) => s.late > 0 || s.avgProgress < 45).slice(0, 3);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Capacidade de Produção</h1>
        <p className="text-sm text-muted-foreground">OEE, WIP, atrasos e carga por fornecedor.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Ordens ativas" value={summary.active} icon={<Factory className="size-4" />} />
        <KPI label="WIP (peças)" value={summary.wip.toLocaleString("pt-BR")} icon={<Clock className="size-4" />} tone="primary" />
        <KPI label="Produzidas" value={summary.produced.toLocaleString("pt-BR")} icon={<CheckCircle2 className="size-4" />} tone="success" />
        <KPI label="OEE médio" value={`${summary.oee.toFixed(0)}%`} icon={<Gauge className="size-4" />} tone={summary.oee >= 70 ? "success" : summary.oee >= 40 ? "warning" : "destructive"} />
        <KPI label="Atrasadas" value={summary.late} icon={<AlertTriangle className="size-4" />} tone="destructive" />
      </div>

      <div className={`rounded-xl border p-4 ${overloaded.length ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}>
        <div className="flex items-center gap-2 text-sm font-medium"><Activity className="size-4 text-primary" /> Leitura do PCP</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {overloaded.length
            ? `Atenção em ${overloaded.map((s) => s.name).join(", ")}: há atraso ou baixa evolução média. Rebalanceie novas OPs antes de liberar mais carga.`
            : "Carga distribuída sem fornecedor crítico no momento. Mantenha a fila atual e acompanhe vencimentos próximos."}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border font-medium">Carga por fornecedor / facção</div>
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando…</div> : bySupplier.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Sem ordens de produção.</div>
        ) : (
          <div className="divide-y divide-border">
            {bySupplier.map((s) => (
              <div key={s.name} className="px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.orders} ordens • {s.qty.toLocaleString("pt-BR")} peças{s.late > 0 && <span className="ml-2 text-destructive">• {s.late} atrasadas</span>}</span>
                </div>
                <div className="h-2 mt-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${s.avgProgress >= 70 ? "bg-success" : s.avgProgress >= 40 ? "bg-warning" : "bg-primary"}`} style={{ width: `${s.avgProgress}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{s.avgProgress.toFixed(0)}% médio</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border font-medium">Ordens em aberto</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Fornecedor</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Qtd</th>
                <th className="text-right px-3 py-2">Progresso</th>
                <th className="text-left px-3 py-2">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {orders.filter((o) => o.status !== "concluida" && o.status !== "cancelada").slice(0, 100).map((o) => {
                const late = o.due_date && new Date(o.due_date).getTime() < today;
                return (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{o.code}</td>
                    <td className="px-3 py-2 text-xs">{o.supplier ?? "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize">{o.status.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-right">{o.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${o.progress}%` }} /></div>
                        <span className="text-xs w-8 text-right">{o.progress}%</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-xs ${late ? "text-destructive font-medium" : "text-muted-foreground"}`}>{o.due_date ? new Date(o.due_date).toLocaleDateString("pt-BR") : "—"}{late && " ⚠"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: number | string; icon: React.ReactNode; tone?: "default" | "success" | "warning" | "destructive" | "primary" }) {
  const tones = { default: "", success: "text-success", warning: "text-warning", destructive: "text-destructive", primary: "text-primary" };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}
