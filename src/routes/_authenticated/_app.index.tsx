import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, Package, Factory, Layers, Scissors, AlertTriangle, CheckCircle2, Sparkles, Activity, TrendingUp, Palette, Shirt, FileText } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { supabase } from "@/integrations/supabase/client";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

export const Route = createFileRoute("/_authenticated/_app/")({
  head: () => ({
    meta: [
      { title: "Command Center · USE MODA PLM" },
      { name: "description", content: "Pulso do desenvolvimento de produto e produção em tempo real." },
    ],
  }),
  component: CommandCenter,
});

function useDashboard() {
  return useQuery({
    queryKey: ["plm-dashboard"],
    queryFn: async () => {
      const [prod, cols, inv, prods, protos, tech, camps] = await Promise.all([
        supabase.from("production_orders").select("id, code, quantity, progress, status, stage, stage_updated_at, created_at, due_date, product_id"),
        supabase.from("collections").select("id, name, status, progress, year, created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("inventory_items").select("name, balance, minimum, unit"),
        supabase.from("products").select("id, name, category, colors, status, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("prototypes").select("id, code, stage, product_id, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("tech_sheets").select("id, product_id, status, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("marketing_campaigns").select("name, investment, roas, status").order("created_at", { ascending: false }).limit(100),
      ]);
      const p = prod.data ?? [];
      const c = cols.data ?? [];
      const i = inv.data ?? [];
      const pr = prods.data ?? [];
      const pt = protos.data ?? [];
      const ts = tech.data ?? [];
      const cmp = camps.data ?? [];

      const activeCollections = c.filter((r: any) => r.status && !/finaliz|conclu/i.test(r.status)).length;
      const productsInDev = pr.filter((r: any) => !r.status || /dev|brief|model|piloto|prot/i.test(r.status)).length;
      const piecesInProd = p.filter((r) => r.status !== "concluida").reduce((a, b) => a + (b.quantity ?? 0), 0);
      const protosOpen = pt.filter((r: any) => r.stage && !/aprov|conclu/i.test(r.stage)).length;
      const critical = i.filter((r) => Number(r.balance ?? 0) <= Number(r.minimum ?? 0));

      // === Alertas operacionais (Onda 2) ===
      const productsWithApprovedSheet = new Set(
        ts.filter((t: any) => t.status === "aprovada" && t.product_id).map((t: any) => t.product_id as string),
      );
      const productsWithoutSheet = pr.filter(
        (r: any) => r.id && !productsWithApprovedSheet.has(r.id) && (!r.status || /dev|brief|model|piloto|prot|aprov/i.test(r.status)),
      );
      const pendingPilots = pt.filter((r: any) => r.stage && /solicit|em_prova|ajuste|pend/i.test(r.stage));
      const STUCK_DAYS = 5;
      const now = Date.now();
      const stuckBatches = p.filter((r: any) => {
        if (r.status === "concluida" || r.status === "cancelada") return false;
        const ref = r.stage_updated_at ?? r.created_at;
        if (!ref) return false;
        return (now - new Date(ref).getTime()) / 86400000 >= STUCK_DAYS;
      });
      const lateBatches = p.filter((r: any) => {
        if (r.status === "concluida" || r.status === "cancelada") return false;
        if (!r.due_date) return false;
        return new Date(r.due_date).getTime() < now && (r.progress ?? 0) < 100;
      });
      const stageCounts = new Map<string, number>();
      p.forEach((r: any) => {
        if (r.status === "concluida" || r.status === "cancelada") return;
        const s = r.stage ?? "—";
        stageCounts.set(s, (stageCounts.get(s) ?? 0) + (r.quantity ?? 0));
      });
      const bottleneck = [...stageCounts.entries()].sort((a, b) => b[1] - a[1])[0];

      const alerts = {
        productsWithoutSheet,
        pendingPilots,
        stuckBatches,
        lateBatches,
        bottleneck: bottleneck ? { stage: bottleneck[0], qty: bottleneck[1] } : null,
      };

      // Production by stage
      const planned = p.reduce((a, b) => a + (b.quantity ?? 0), 0);
      const done = p.reduce((a, b) => a + Math.round((b.quantity ?? 0) * ((b.progress ?? 0) / 100)), 0);
      const productionData = [
        { d: "Planejado", v: planned },
        { d: "Em curso", v: done },
        { d: "Concluído", v: p.filter((r) => r.status === "concluida").reduce((a, b) => a + (b.quantity ?? 0), 0) },
      ];

      // Development pipeline buckets
      const bucket = (re: RegExp) => pr.filter((r: any) => re.test(r.status ?? "")).length;
      const devPipeline = [
        { d: "Briefing", v: bucket(/brief|pesquis/i) || pr.filter((r: any) => !r.status).length },
        { d: "Modelagem", v: bucket(/model|cad/i) },
        { d: "Protótipo", v: bucket(/prot/i) + pt.length },
        { d: "Piloto", v: bucket(/piloto/i) },
        { d: "Aprovado", v: bucket(/aprov/i) },
      ];

      type FeedItem = { ts: number; kind: "produto" | "coleção" | "produção" | "ficha" | "protótipo"; title: string; meta?: string };
      const feed: FeedItem[] = [];
      pr.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "produto", title: `Produto ${r.name} criado`, meta: r.category ?? undefined }));
      c.forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "coleção", title: `Coleção ${r.name}`, meta: r.status }));
      p.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "produção", title: `OP ${r.code ?? ""} · ${r.quantity ?? 0} pç`, meta: r.status }));
      pt.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "protótipo", title: `Protótipo ${r.code ?? ""}`, meta: r.stage }));
      ts.slice(0, 8).forEach((r: any) => r.created_at && feed.push({ ts: new Date(r.created_at).getTime(), kind: "ficha", title: `Ficha técnica atualizada`, meta: r.status }));
      feed.sort((a, b) => b.ts - a.ts);

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
        kpis: { activeCollections, productsInDev, piecesInProd, protosOpen },
        critical,
        alerts,
        collections: c,
        productionData,
        devPipeline,
        feed: feed.slice(0, 12),
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
  ficha: FileText,
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
    { label: "Coleções ativas", value: k ? String(k.activeCollections) : "—", icon: Layers, color: "text-primary" },
    { label: "Produtos em desenvolvimento", value: k ? String(k.productsInDev) : "—", icon: Sparkles, color: "text-info" },
    { label: "Peças em produção", value: k ? k.piecesInProd.toLocaleString("pt-BR") : "—", icon: Factory, color: "text-success" },
    { label: "Protótipos em aberto", value: k ? String(k.protosOpen) : "—", icon: Scissors, color: "text-warning" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Command Center · PLM</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {greeting}, <span className="text-gradient">USE Moda</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Desenvolvimento, produção e cadeia em tempo real{today && ` · ${today}`}
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">Financeiro no ERP</span>
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

      {/* === Alertas operacionais === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Produtos sem ficha", value: data?.alerts?.productsWithoutSheet.length ?? 0, to: "/ficha-tecnica", tone: "warning" as const },
          { label: "Pilotos pendentes", value: data?.alerts?.pendingPilots.length ?? 0, to: "/pilots", tone: "info" as const },
          { label: "Lotes parados (5d+)", value: data?.alerts?.stuckBatches.length ?? 0, to: "/pcp-kanban", tone: "warning" as const },
          { label: "Lotes atrasados", value: data?.alerts?.lateBatches.length ?? 0, to: "/pcp", tone: "danger" as const },
          {
            label: "Setor gargalo",
            value: data?.alerts?.bottleneck ? `${data.alerts.bottleneck.stage}` : "—",
            sub: data?.alerts?.bottleneck ? `${data.alerts.bottleneck.qty} pç` : undefined,
            to: "/twin-factory",
            tone: "info" as const,
          },
        ].map((a) => {
          const toneCls =
            a.tone === "danger" ? "text-destructive" : a.tone === "warning" ? "text-warning" : "text-info";
          const isZero = typeof a.value === "number" && a.value === 0;
          return (
            <Link
              key={a.label}
              to={a.to}
              className="glass rounded-xl p-4 hover:border-primary/40 transition-colors flex items-start gap-3"
            >
              <AlertTriangle className={`size-4 mt-0.5 shrink-0 ${isZero ? "text-success" : toneCls}`} />
              <div className="min-w-0">
                <div className="text-lg font-semibold tabular-nums leading-tight truncate">
                  {isLoading ? "…" : (isZero ? "✓" : a.value)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{a.label}</div>
                {("sub" in a) && a.sub && <div className="text-[11px] text-muted-foreground/80 tabular-nums">{a.sub}</div>}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AICoordinatorPanel persona="development" title="Desenvolvimento · prioridades" />
        <AICoordinatorPanel persona="pcp" title="Produção · diagnóstico do dia" />
        <AICoordinatorPanel persona="marketing" title="Marketing · onde investir" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AICoordinatorPanel
          persona="pcp"
          title="Qualidade · pontos de atenção"
          question="Quais defeitos e retrabalhos mais aparecem agora e como reduzir? Liste 3 ações."
        />
        <AICoordinatorPanel
          persona="marketing"
          title="Comercial · risco de meta"
          question="Estou no caminho de bater a meta comercial do mês? Onde os riscos e o que fazer hoje?"
        />
      </div>




      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Pipeline de desenvolvimento</div>
              <div className="text-xs text-muted-foreground">Produtos por etapa do ciclo PLM</div>
            </div>
            <Link to="/dev-kanban" className="text-xs text-primary hover:underline">Abrir Kanban →</Link>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.devPipeline ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[4, 4, 0, 0]} />
            </BarChart>
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
          <div className="text-sm font-semibold mb-1">Alertas de insumos</div>
          <div className="text-xs text-muted-foreground mb-4">Itens técnicos em nível crítico</div>
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
              Insumos saudáveis
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><Activity className="size-4 text-primary" /> Feed operacional</div>
              <div className="text-xs text-muted-foreground">Últimos eventos de desenvolvimento e produção</div>
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
        <div className="text-sm font-semibold mb-3">Acesso rápido aos módulos PLM</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULES.filter((m) => m.path !== "/" && !m.hidden && m.source !== "erp-mirror").slice(0, 12).map((m) => {
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
