import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { TrendingUp, ShoppingBag, Receipt, Target } from "lucide-react";

export const Route = createFileRoute("/_app/sales-performance")({
  component: SalesPerformance,
});

type Sale = { product_id: string | null; sku: string | null; channel: string; quantity: number; total: number; sold_at: string };

async function load() {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data } = await supabase.from("sales").select("product_id, sku, channel, quantity, total, sold_at").gte("sold_at", since);
  return (data ?? []) as Sale[];
}

function SalesPerformance() {
  const { data: sales = [], isLoading } = useQuery({ queryKey: ["sales-perf"], queryFn: load });

  const totals = useMemo(() => {
    const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
    const qty = sales.reduce((s, x) => s + x.quantity, 0);
    const orders = sales.length;
    const ticket = orders > 0 ? revenue / orders : 0;
    return { revenue, qty, orders, ticket };
  }, [sales]);

  const byChannel = useMemo(() => {
    const m = new Map<string, { revenue: number; qty: number; orders: number }>();
    sales.forEach((s) => {
      const c = m.get(s.channel) ?? { revenue: 0, qty: 0, orders: 0 };
      c.revenue += Number(s.total); c.qty += s.quantity; c.orders += 1;
      m.set(s.channel, c);
    });
    return Array.from(m.entries()).map(([k, v]) => ({ channel: k, ...v })).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  const bySku = useMemo(() => {
    const m = new Map<string, { sku: string; revenue: number; qty: number }>();
    sales.forEach((s) => {
      const k = s.sku ?? "—";
      const c = m.get(k) ?? { sku: k, revenue: 0, qty: 0 };
      c.revenue += Number(s.total); c.qty += s.quantity;
      m.set(k, c);
    });
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [sales]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => {
      const d = s.sold_at.slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + Number(s.total));
    });
    const days = Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
    const max = Math.max(1, ...days.map(([, v]) => v));
    return days.map(([d, v]) => ({ d, v, h: (v / max) * 100 }));
  }, [sales]);

  const totalChan = byChannel.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Performance</h1>
        <p className="text-sm text-muted-foreground">Receita, canais e top SKUs nos últimos 90 dias.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Receita" value={fmt(totals.revenue)} icon={<TrendingUp className="size-4" />} tone="success" />
        <KPI label="Pedidos" value={totals.orders.toLocaleString("pt-BR")} icon={<Receipt className="size-4" />} />
        <KPI label="Peças" value={totals.qty.toLocaleString("pt-BR")} icon={<ShoppingBag className="size-4" />} />
        <KPI label="Ticket médio" value={fmt(totals.ticket)} icon={<Target className="size-4" />} tone="primary" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="font-medium mb-3">Receita diária (30d)</div>
        {isLoading ? <div className="text-muted-foreground text-sm">Carregando…</div> : byDay.length === 0 ? (
          <div className="text-muted-foreground text-sm">Sem vendas no período.</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {byDay.map((b) => (
              <div key={b.d} className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors" style={{ height: `${b.h}%` }} title={`${b.d}: ${fmt(b.v)}`} />
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border font-medium">Por canal</div>
          <div className="divide-y divide-border">
            {byChannel.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Sem dados.</div>}
            {byChannel.map((c) => (
              <div key={c.channel} className="px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{c.channel}</span>
                  <span>{fmt(c.revenue)} <span className="text-xs text-muted-foreground">({totalChan > 0 ? Math.round((c.revenue / totalChan) * 100) : 0}%)</span></span>
                </div>
                <div className="h-1.5 mt-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${totalChan > 0 ? (c.revenue / totalChan) * 100 : 0}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{c.orders} pedidos • {c.qty} peças</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border font-medium">Top 20 SKUs</div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {bySku.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Sem dados.</div>}
            {bySku.map((s, i) => (
              <div key={s.sku} className="px-4 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                  <span className="font-mono text-xs truncate">{s.sku}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{fmt(s.revenue)}</div>
                  <div className="text-[10px] text-muted-foreground">{s.qty} pç</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: "default" | "success" | "primary" }) {
  const tones = { default: "", success: "text-success", primary: "text-primary" };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
