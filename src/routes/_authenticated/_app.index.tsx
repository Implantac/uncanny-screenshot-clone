import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, Package, Factory, Users, CircleDollarSign, AlertTriangle, CheckCircle2, Sparkles, Activity, TrendingUp, Palette, Shirt, Scissors } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/_app/")({
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
      const [orders, prod, cols, inv, prods, protos] = await Promise.all([
        supabase.from("b2b_orders").select("total_value, customer_name, order_date, status, created_at"),
        supabase.from("production_orders").select("code, quantity, progress, status, created_at, due_date"),
        supabase.from("collections").select("name, status, progress, year, created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("inventory_items").select("name, balance, minimum, unit"),
        supabase.from("products").select("name, category, colors, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("prototypes").select("code, stage, created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      const o = orders.data ?? [];
      const p = prod.data ?? [];
      const c = cols.data ?? [];
      const i = inv.data ?? [];
      const pr = prods.data ?? [];
      const pt = protos.data ?? [];

      const now = new Date();
      const thisMonth = (d: string) => { const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
      const revenue = o.filter((r) => r.order_date && thisMonth(r.order_date)).reduce((a, b) => a + Number(b.total_value ?? 0), 0);
      const pieces = p.filter((r) => r.status !== "concluida").reduce((a, b) => a + (b.quantity ?? 0), 0);
      const ordersCount = o.length;
      const customers = new Set(o.map((r) => r.customer_name).filter(Boolean)).size;
      const critical = i.filter((r) => Number(r.balance ?? 0) <= Number(r.minimum ?? 0));

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

      const planned = p.reduce((a, b) => a + (b.quantity ?? 0), 0);
      const done = p.reduce((a, b) => a + Math.round((b.quantity ?? 0) * ((b.progress ?? 0) / 100)), 0);
      const productionData = [
        { d: "Planejado", v: planned },
        { d: "Em curso", v: done },
        { d: "Concluído", v: p.filter((r) => r.status === "concluida").reduce((a, b) => a + (b.quantity ?? 0), 0) },
      ];

      // Operational feed — unified timeline of recent events
      type FeedItem = { ts: number; kind: "produto" | "coleção" | "produção" | "pedido" | "protótipo"; title: string; meta?: string };
      const feed: FeedItem[] = [];
      pr.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "produto", title: `Produto ${r.name} criado`, meta: r.category ?? undefined }));
      c.forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "coleção", title: `Coleção ${r.name}`, meta: r.status }));
      p.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "produção", title: `OP ${r.code ?? ""} · ${r.quantity ?? 0} pç`, meta: r.status }));
      o.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "pedido", title: `Pedido B2B · ${r.customer_name ?? "—"}`, meta: r.status }));
      pt.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "protótipo", title: `Protótipo ${r.code ?? ""}`, meta: r.stage }));
      feed.sort((a, b) => b.ts - a.ts);

      // Trend radar — most frequent attributes across recent products
      const count = (arr: (string | null | undefined)[]) => {
        const m = new Map<string, number>();
        arr.forEach((x) => { if (x) m.set(x, (m.get(x) ?? 0) + 1); });
        return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => ({ label, n }));
      };
      const trends = {
        colors: count(pr.flatMap((r: any) => Array.isArray(r.colors) ? r.colors : [])),
        categories: count(pr.map((r: any) => r.category)),
        collections: count(c.map((r: any) => r.name)),
      };


      return {
        kpis: { revenue, pieces, ordersCount, customers },
        critical,
        collections: c,
        months,
        productionData,
        feed: feed.slice(0, 10),
        trends,
      };
    },
  });
}

function relTime(ts: number) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

const FEED_ICON: Record<string, typeof Activity> = {
  produto: Package,
  coleção: Sparkles,
  produção: Factory,
  pedido: CircleDollarSign,
  protótipo: Scissors,
};

function TrendBlock({ icon: Icon, title, items }: { icon: typeof Activity; title: string; items: { label: string; n: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2"><Icon className="size-3.5" /> {title}</div>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 truncate">{it.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${(it.n / max) * 100}%` }} />
              </div>
              <span className="tabular-nums text-muted-foreground w-6 text-right">{it.n}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-muted-foreground">Sem dados ainda</div>
      )}
    </div>
  );
}




function CommandCenter() {
  const { data, isLoading } = useDashboard();
  const [today, setToday] = useState("");
  useEffect(() => { setToday(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })); }, []);
  const k = data?.kpis;
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

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
            {greeting}, <span className="text-gradient">USE Moda</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><Activity className="size-4 text-primary" /> Feed operacional</div>
              <div className="text-xs text-muted-foreground">Últimos eventos da operação</div>
            </div>
          </div>
          {data?.feed?.length ? (
            <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-1 before:bottom-1 before:w-px before:bg-border">
              {data.feed.map((f, idx) => {
                const Icon = FEED_ICON[f.kind] ?? Activity;
                return (
                  <li key={idx} className="relative flex gap-3 pl-0">
                    <div className="size-8 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center ring-4 ring-background">
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="text-sm font-medium truncate">{f.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="uppercase tracking-wide">{f.kind}</span>
                        {f.meta && <><span>·</span><span className="truncate">{f.meta}</span></>}
                        <span>·</span><span>{relTime(f.ts)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem eventos recentes</div>
          )}
        </div>

        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Radar de tendências</div>
          <div className="text-xs text-muted-foreground mb-4">Sinais do seu catálogo</div>
          {data && (
            <div className="space-y-5">
              <TrendBlock icon={Palette} title="Cores em alta" items={data.trends.colors} />
              <TrendBlock icon={Shirt} title="Categorias" items={data.trends.categories} />
              <TrendBlock icon={Sparkles} title="Coleções ativas" items={data.trends.collections} />
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
