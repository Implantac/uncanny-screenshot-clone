import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Package, Factory, Users, CircleDollarSign, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { MODULES } from "@/lib/modules";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Command Center · USE MODA OS" },
      { name: "description", content: "Visão executiva em tempo real da operação de moda." },
    ],
  }),
  component: CommandCenter,
});

const revenueData = [
  { m: "Jan", v: 1.2 }, { m: "Fev", v: 1.4 }, { m: "Mar", v: 1.35 },
  { m: "Abr", v: 1.6 }, { m: "Mai", v: 1.85 }, { m: "Jun", v: 2.05 },
  { m: "Jul", v: 2.3 }, { m: "Ago", v: 2.55 }, { m: "Set", v: 2.8 },
  { m: "Out", v: 3.1 }, { m: "Nov", v: 3.4 }, { m: "Dez", v: 3.7 },
];

const productionData = [
  { d: "Seg", planejado: 1200, real: 1150 },
  { d: "Ter", planejado: 1300, real: 1280 },
  { d: "Qua", planejado: 1250, real: 1320 },
  { d: "Qui", planejado: 1400, real: 1360 },
  { d: "Sex", planejado: 1500, real: 1480 },
  { d: "Sáb", planejado: 800, real: 820 },
];

const kpis = [
  { label: "Receita do mês", value: "R$ 3.7M", delta: "+12.4%", up: true, icon: CircleDollarSign, color: "text-success" },
  { label: "Produção (peças)", value: "84.320", delta: "+5.8%", up: true, icon: Factory, color: "text-info" },
  { label: "Pedidos B2B", value: "1.247", delta: "+18.2%", up: true, icon: Package, color: "text-primary" },
  { label: "Clientes ativos", value: "382", delta: "-2.1%", up: false, icon: Users, color: "text-warning" },
];

const activities = [
  { icon: CheckCircle2, color: "text-success", text: "Coleção Verão 26 aprovada por Diretoria de Estilo", time: "há 12 min" },
  { icon: AlertTriangle, color: "text-warning", text: "Estoque crítico: malha algodão pima (12kg restantes)", time: "há 38 min" },
  { icon: Clock, color: "text-info", text: "OP #4821 atrasada · facção Santos & Cia", time: "há 1h" },
  { icon: CheckCircle2, color: "text-success", text: "Fornecedor Tecidos Paulista confirmou entrega 18/06", time: "há 2h" },
  { icon: TrendingUp, color: "text-primary", text: "Pico de vendas B2B: +42% vs semana anterior", time: "há 3h" },
];

const collections = [
  { name: "Verão 26", progress: 78, status: "Em desenvolvimento", pieces: 142 },
  { name: "Resort 26", progress: 92, status: "Finalizando", pieces: 86 },
  { name: "Inverno 25", progress: 100, status: "Em produção", pieces: 218 },
  { name: "Pre-Fall 26", progress: 24, status: "Briefing", pieces: 64 },
];

function CommandCenter() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Command Center</div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Boa tarde, <span className="text-gradient">USE Moda</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aqui está o pulso da sua operação em tempo real · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-9 px-4 rounded-md text-sm font-medium bg-muted hover:bg-muted/70 transition-colors">Exportar</button>
          <button className="h-9 px-4 rounded-md text-sm font-medium bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 transition-opacity">
            Nova ação
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="glass rounded-xl p-5 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-start justify-between relative">
                <Icon className={`size-5 ${k.color}`} />
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${k.up ? "text-success" : "text-destructive"}`}>
                  {k.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {k.delta}
                </span>
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Receita anual</div>
              <div className="text-xs text-muted-foreground">Faturamento mês a mês (R$ milhões)</div>
            </div>
            <div className="text-xs text-muted-foreground">2025</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
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
          <div className="text-sm font-semibold">Produção semanal</div>
          <div className="text-xs text-muted-foreground mb-4">Planejado vs real</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={productionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="planejado" fill="oklch(0.30 0.04 295)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="real" fill="oklch(0.72 0.18 295)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coleções + Atividades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Coleções ativas</div>
              <div className="text-xs text-muted-foreground">Status do desenvolvimento</div>
            </div>
            <Link to="/colecoes" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </div>
          <div className="space-y-4">
            {collections.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">· {c.pieces} peças</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c.status}</span>
                    <span className="text-xs font-medium tabular-nums">{c.progress}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-[image:var(--gradient-primary)] transition-all"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold mb-1">Atividade recente</div>
          <div className="text-xs text-muted-foreground mb-4">Últimas atualizações</div>
          <ul className="space-y-3">
            {activities.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <Icon className={`size-4 mt-0.5 shrink-0 ${a.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground/90 leading-snug">{a.text}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.time}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Quick access */}
      <div>
        <div className="text-sm font-semibold mb-3">Acesso rápido aos módulos</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULES.filter((m) => m.path !== "/").slice(0, 12).map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.slug}
                to={m.path}
                className="glass rounded-xl p-4 hover:border-primary/40 hover:-translate-y-0.5 transition-all group"
              >
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
