import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Wallet, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/cashflow")({
  component: Cashflow,
});

type Acc = {
  id: string;
  type: "pagar" | "receber";
  description: string;
  due_date: string;
  value: number;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
};

async function load(): Promise<Acc[]> {
  const { data } = await supabase.from("financial_accounts").select("*").order("due_date", { ascending: true });
  return (data ?? []).map((a) => ({ ...a, value: Number(a.value) })) as Acc[];
}

function Cashflow() {
  const { data: accs = [], isLoading } = useQuery({ queryKey: ["cashflow"], queryFn: load });
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const totals = useMemo(() => {
    const open = accs.filter((a) => a.status === "pendente" || a.status === "atrasado");
    const toReceive = open.filter((a) => a.type === "receber").reduce((s, a) => s + a.value, 0);
    const toPay = open.filter((a) => a.type === "pagar").reduce((s, a) => s + a.value, 0);
    const overdue = open.filter((a) => new Date(a.due_date) < today);
    const overdueValue = overdue.reduce((s, a) => s + (a.type === "receber" ? a.value : -a.value), 0);
    return { toReceive, toPay, net: toReceive - toPay, overdue: overdue.length, overdueValue };
  }, [accs, today]);

  // 30-day projection
  const projection = useMemo(() => {
    const days: { d: string; in: number; out: number; net: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const day = new Date(today.getTime() + i * 86400000);
      const key = day.toISOString().slice(0, 10);
      const dayAccs = accs.filter((a) => a.due_date === key && (a.status === "pendente" || a.status === "atrasado"));
      const inc = dayAccs.filter((a) => a.type === "receber").reduce((s, a) => s + a.value, 0);
      const out = dayAccs.filter((a) => a.type === "pagar").reduce((s, a) => s + a.value, 0);
      days.push({ d: key, in: inc, out, net: inc - out });
    }
    let running = 0;
    return days.map((d) => { running += d.net; return { ...d, running }; });
  }, [accs, today]);

  const maxAbs = Math.max(1, ...projection.map((p) => Math.abs(p.running)));
  const overdueList = useMemo(() => accs.filter((a) => (a.status === "pendente" || a.status === "atrasado") && new Date(a.due_date) < today).slice(0, 50), [accs, today]);
  const upcoming = useMemo(() => accs.filter((a) => (a.status === "pendente" || a.status === "atrasado") && new Date(a.due_date) >= today).slice(0, 50), [accs, today]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cashflow Health</h1>
        <p className="text-sm text-muted-foreground">Saldo projetado, atrasos e próximas movimentações.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="A receber" value={fmt(totals.toReceive)} icon={<TrendingUp className="size-4" />} tone="success" />
        <KPI label="A pagar" value={fmt(totals.toPay)} icon={<TrendingDown className="size-4" />} tone="destructive" />
        <KPI label="Saldo líquido" value={fmt(totals.net)} icon={<Wallet className="size-4" />} tone={totals.net >= 0 ? "success" : "destructive"} />
        <KPI label="Atrasos" value={`${totals.overdue} • ${fmt(Math.abs(totals.overdueValue))}`} icon={<AlertTriangle className="size-4" />} tone="warning" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="font-medium mb-3">Projeção de saldo — próximos 30 dias</div>
        {isLoading ? <div className="text-muted-foreground text-sm">Carregando…</div> : (
          <div className="flex items-end gap-1 h-32 relative">
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-border" />
            {projection.map((p) => {
              const h = (Math.abs(p.running) / maxAbs) * 50;
              const positive = p.running >= 0;
              return (
                <div key={p.d} className="flex-1 flex flex-col justify-center items-center relative" title={`${p.d}: saldo ${fmt(p.running)}`}>
                  <div className={`w-full ${positive ? "bg-success/40" : "bg-destructive/40"} rounded-sm`} style={{ height: `${h}%`, marginTop: positive ? `${50 - h}%` : "50%" }} />
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
          <span>Hoje</span>
          <span>+30d</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <List title="Atrasados" items={overdueList} tone="destructive" />
        <List title="Próximos vencimentos" items={upcoming} tone="primary" />
      </div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: Acc[]; tone: "destructive" | "primary" }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border font-medium">{title}</div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Nada por aqui.</div>}
        {items.map((a) => (
          <div key={a.id} className="px-4 py-2 flex items-center justify-between text-sm">
            <div className="min-w-0">
              <div className="truncate">{a.description}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(a.due_date).toLocaleDateString("pt-BR")} • {a.type === "receber" ? "Receber" : "Pagar"}</div>
            </div>
            <span className={`font-medium ${a.type === "receber" ? "text-success" : "text-destructive"}`}>
              {a.type === "receber" ? "+" : "-"}{fmt(a.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: "default" | "success" | "destructive" | "warning" }) {
  const tones = { default: "", success: "text-success", destructive: "text-destructive", warning: "text-warning" };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
