import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, Package, Factory, Users, CircleDollarSign, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Command Center · USE MODA OS" },
      { name: "description", content: "Visão executiva em tempo real da operação de moda." },
    ],
  }),
  component: CommandCenter,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [orders, prod, cols, inv] = await Promise.all([
        supabase.from("b2b_orders").select("total_value, customer_name, order_date, status, created_at"),
        supabase.from("production_orders").select("quantity, progress, status, created_at, due_date"),
        supabase.from("collections").select("name, status, progress, year").order("created_at", { ascending: false }).limit(6),
        supabase.from("inventory_items").select("name, balance, minimum, unit"),
      ]);
      const o = orders.data ?? [];
      const p = prod.data ?? [];
      const c = cols.data ?? [];
      const i = inv.data ?? [];

      const now = new Date();
      const thisMonth = (d: string) => { const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
      const revenue = o.filter((r) => r.order_date && thisMonth(r.order_date)).reduce((a, b) => a + Number(b.total_value ?? 0), 0);
      const pieces = p.filter((r) => r.status !== "concluida").reduce((a, b) => a + (b.quantity ?? 0), 0);
      const ordersCount = o.length;
      const customers = new Set(o.map((r) => r.customer_name).filter(Boolean)).size;
      const critical = i.filter((r) => Number(r.balance ?? 0) <= Number(r.minimum ?? 0));

      // 12-month revenue series
      const months: { m: string; v: number }[] = [];
      for (let k = 11; k >= 0; k--) {
        const dt = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const label = dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        const v = o.filter((r) => {
          if (!r.order_date) return false;
          const x = new Date(r.order_date);
          return x.getMonth() === dt.getMonth() && x.getFullYear() === dt.getFullYear();
        }).reduce((a, b) => a + Number(b.total_value ?? 0), 0) / 1000;
        months.push({ m: label, v: Number(v.toFixed(1)) });
      }

      // Production: planned vs delivered per status
      const planned = p.reduce((a, b) => a + (b.quantity ?? 0), 0);
      const done = p.reduce((a, b) => a + Math.round((b.quantity ?? 0) * ((b.progress ?? 0) / 100)), 0);
      const productionData = [
        { d: "Planejado", v: planned },
        { d: "Em curso", v: done },
        { d: "Concluído", v: p.filter((r) => r.status === "concluida").reduce((a, b) => a + (b.quantity ?? 0), 0) },
      ];

      return {
        kpis: { revenue, pieces, ordersCount, customers },
        critical,
        collections: c,
        months,
        productionData,
      };
    },
  });
}

function CommandCenter() {
  const { data, isLoading } = useDashboard();
  const [today, setToday] = useState("");
  useEffect(() => { setToday(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })); }, []);
  const k = data?.kpis;

  const kpis = [
    { label: "Receita do mês", value: k ? brl(k.revenue) : "—", icon: CircleDollarSign, color: "text-success" },
    { label: "Peças em produção", value: k ? k.pieces.toLocaleString("pt-BR") : "—", icon: Factory, color: "text-info" },
    { label: "Pedidos B2B", value: k ? String(k.ordersCount) : "—", icon: Package, color: "text-primary" },
    { label: "Clientes únicos", value: k ? String(k.customers) : "—", icon: Users, color: "text-warning" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Command Center</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Boa tarde, <span className="text-gradient">USE Moda</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pulso da operação em tempo real{today && ` · ${today}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="glass rounded-xl p-5 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-start justify-between relative">
                <Icon className={`size-5 ${kpi.color}`} />
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{isLoading ? "…" : kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Receita 12 meses</div>
              <div className="text-xs text-muted-foreground">Faturamento B2B em milhares (R$)</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data?.months ?? []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 295)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 295)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
              <XAxis dataKey="m" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke="oklch(0.72 0.18 295)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold">Produção</div>
          <div className="text-xs text-muted-foreground mb-4">Peças por estágio</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.productionData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Coleções</div>
              <div className="text-xs text-muted-foreground">Status do desenvolvimento</div>
            </div>
            <Link to="/colecoes" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </div>
          {data?.collections.length ? (
            <div className="space-y-4">
              {data.collections.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">· {c.year}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{c.status}</span>
                      <span className="text-xs font-medium tabular-nums">{c.progress ?? 0}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-[image:var(--gradient-primary)] transition-all" style={{ width: `${c.progress ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Sparkles className="size-8 text-primary mx-auto mb-2" />
              Nenhuma coleção cadastrada
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold mb-1">Alertas de estoque</div>
          <div className="text-xs text-muted-foreground mb-4">Itens em nível crítico</div>
          {data?.critical.length ? (
            <ul className="space-y-3">
              {data.critical.slice(0, 6).map((i, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <div className="leading-snug truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      {Number(i.balance)} {i.unit} · min {Number(i.minimum)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="size-8 text-success mx-auto mb-2" />
              Estoque saudável
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-3">Acesso rápido aos módulos</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULES.filter((m) => m.path !== "/").slice(0, 12).map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.slug} to={m.path} className="glass rounded-xl p-4 hover:border-primary/40 hover:-translate-y-0.5 transition-all group">
                <Icon className="size-5 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-sm font-medium leading-tight">{m.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{m.short}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
