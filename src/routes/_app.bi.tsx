import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/bi")({
  head: () => ({
    meta: [
      { title: "BI & Analytics · USE MODA OS" },
      { name: "description", content: "Dashboards customizáveis e KPIs." },
    ],
  }),
  component: BI,
});

const vendaCanal = [
  { name: "B2B Multimarcas", v: 42 },
  { name: "E-commerce D2C",  v: 28 },
  { name: "Lojas próprias",  v: 18 },
  { name: "Showroom",        v: 12 },
];
const palette = ["oklch(0.72 0.18 295)","oklch(0.70 0.16 200)","oklch(0.74 0.17 155)","oklch(0.78 0.16 75)"];

const ranking = [
  { p: "Vestido Midi Linho",  v: 1240 },
  { p: "Blazer Oversized",    v: 980 },
  { p: "Calça Wide",          v: 870 },
  { p: "Top Cropped",         v: 760 },
  { p: "Camisa Linho MC",     v: 640 },
];

const trend = Array.from({ length: 30 }, (_, i) => ({ d: i+1, v: Math.round(80 + Math.sin(i/3)*15 + i*1.2 + Math.random()*10) }));

function BI() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <BarChart3 className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BI e Analytics</h1>
          <p className="text-sm text-muted-foreground">Dashboards e KPIs do negócio</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Conversão B2B", v: "34%", d: "+4.2pp" },
          { l: "Sell-through 90d", v: "68%", d: "+2.1pp" },
          { l: "Lead time médio", v: "42 dias", d: "-3d" },
          { l: "Custo por peça", v: "R$ 78", d: "-R$ 4" },
        ].map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
            <div className="text-xs text-success mt-0.5 inline-flex items-center gap-0.5"><TrendingUp className="size-3" />{k.d}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="text-sm font-semibold">Tendência de vendas (30d)</div>
          <div className="text-xs text-muted-foreground mb-4">Unidades vendidas por dia</div>
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
          <div className="text-sm font-semibold">Mix por canal</div>
          <div className="text-xs text-muted-foreground mb-4">% da receita</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={vendaCanal} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {vendaCanal.map((_, i) => <Cell key={i} fill={palette[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {vendaCanal.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: palette[i] }} />{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{c.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold">Top 5 produtos (unidades vendidas)</div>
        <div className="text-xs text-muted-foreground mb-4">Últimos 30 dias</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ranking} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" horizontal={false} />
            <XAxis type="number" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="p" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} width={150} />
            <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
