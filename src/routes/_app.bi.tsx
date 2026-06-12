import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/bi")({
  head: () => ({
    meta: [
      { title: "BI & Analytics · USE MODA OS" },
      { name: "description", content: "Dashboards customizáveis e KPIs." },
    ],
  }),
  component: BI,
});

const palette = ["oklch(0.72 0.18 295)","oklch(0.70 0.16 200)","oklch(0.74 0.17 155)","oklch(0.78 0.16 75)","oklch(0.70 0.18 25)"];
const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function BI() {
  const ordersQ = useQuery({
    queryKey: ["bi", "b2b_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("b2b_orders").select("status,total_value,order_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const productsQ = useQuery({
    queryKey: ["bi", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,status");
      if (error) throw error;
      return data ?? [];
    },
  });
  const finQ = useQuery({
    queryKey: ["bi", "fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_accounts").select("type,value,status");
      if (error) throw error;
      return data ?? [];
    },
  });
  const prodOrdQ = useQuery({
    queryKey: ["bi", "prod_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("quantity,products(name)")
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const orders = ordersQ.data ?? [];
  const products = productsQ.data ?? [];
  const fin = finQ.data ?? [];
  const prodOrd = prodOrdQ.data ?? [];

  const totalReceita = orders.reduce((s, o) => s + Number(o.total_value ?? 0), 0);
  const pedidosAtivos = orders.filter((o) => o.status !== "cancelado").length;
  const produtosAtivos = products.filter((p) => p.status === "aprovado" || p.status === "producao").length;
  const aReceber = fin.filter((f) => f.type === "receber" && f.status === "pendente").reduce((s, f) => s + Number(f.value), 0);
  const aPagar = fin.filter((f) => f.type === "pagar" && f.status === "pendente").reduce((s, f) => s + Number(f.value), 0);
  const saldo = aReceber - aPagar;

  const trend = useMemo(() => {
    const days: { d: string; v: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now); dt.setDate(now.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const v = orders.filter((o) => (o.order_date ?? "").slice(0, 10) === key).reduce((s, o) => s + Number(o.total_value ?? 0), 0);
      days.push({ d: key.slice(5), v: Math.round(v) });
    }
    return days;
  }, [orders]);

  const mix = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + Number(o.total_value ?? 0)));
    return Array.from(map.entries()).map(([name, v]) => ({ name, v: Math.round(v) }));
  }, [orders]);

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    prodOrd.forEach((p: any) => {
      const name = p.products?.name ?? "Sem produto";
      map.set(name, (map.get(name) ?? 0) + Number(p.quantity ?? 0));
    });
    return Array.from(map.entries()).map(([p, v]) => ({ p, v })).sort((a, b) => b.v - a.v).slice(0, 5);
  }, [prodOrd]);

  const kpis = [
    { l: "Receita B2B total", v: BRL(totalReceita), d: `${orders.length} pedidos`, up: true },
    { l: "Pedidos ativos", v: pedidosAtivos.toString(), d: "B2B", up: true },
    { l: "Produtos ativos", v: produtosAtivos.toString(), d: `${products.length} no total`, up: true },
    { l: "Saldo projetado", v: BRL(saldo), d: `${BRL(aReceber)} / ${BRL(aPagar)}`, up: saldo >= 0 },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <BarChart3 className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BI e Analytics</h1>
          <p className="text-sm text-muted-foreground">Dashboards e KPIs do negócio (dados reais)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
            <div className={`text-xs mt-0.5 inline-flex items-center gap-0.5 ${k.up ? "text-success" : "text-destructive"}`}>
              {k.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{k.d}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="text-sm font-semibold">Tendência de receita B2B (30d)</div>
          <div className="text-xs text-muted-foreground mb-4">Receita por dia (R$)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="v" stroke="oklch(0.72 0.18 295)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold">Mix por status de pedido</div>
          <div className="text-xs text-muted-foreground mb-4">Receita por status</div>
          {mix.length === 0 ? (
            <div className="h-[240px] grid place-items-center text-xs text-muted-foreground">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={mix} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {mix.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-1.5 mt-2">
            {mix.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: palette[i % palette.length] }} />{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{BRL(c.v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold">Top 5 produtos por quantidade em produção</div>
        <div className="text-xs text-muted-foreground mb-4">Soma das ordens de produção</div>
        {ranking.length === 0 ? (
          <div className="h-[220px] grid place-items-center text-xs text-muted-foreground">Sem ordens de produção</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ranking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" horizontal={false} />
              <XAxis type="number" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="p" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} width={150} />
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
