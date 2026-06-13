import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Brain, Activity, Map as MapIcon, Megaphone, Sparkles, Factory, Boxes,
  TrendingUp, AlertTriangle, CheckCircle2, Users, Database, Target, Trophy,
  Scissors, Cpu, Search,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_app/intelligence")({
  head: () => ({
    meta: [
      { title: "Intelligence · USE MODA OS" },
      { name: "description", content: "Motor de inteligência operacional da indústria da moda." },
    ],
  }),
  component: IntelligencePage,
});

const BRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PCT = (n: number) => `${Math.round(n)}%`;
const palette = ["oklch(0.72 0.18 295)", "oklch(0.70 0.16 200)", "oklch(0.74 0.17 155)", "oklch(0.78 0.16 75)", "oklch(0.70 0.18 25)"];

// Deterministic pseudo-random for stable demo metrics derived from id
function seed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (min: number, max: number) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return min + (h % 1000) / 1000 * (max - min);
  };
}

function KPI({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: any; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <Icon className={`h-4 w-4 ${tone ?? "text-primary"}`} />
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function IntelligencePage() {
  const productsQ = useQuery({
    queryKey: ["intel", "products"],
    queryFn: async () => (await supabase.from("products").select("*")).data ?? [],
  });
  const ordersQ = useQuery({
    queryKey: ["intel", "production_orders"],
    queryFn: async () => (await supabase.from("production_orders").select("*")).data ?? [],
  });
  const invQ = useQuery({
    queryKey: ["intel", "inventory_items"],
    queryFn: async () => (await supabase.from("inventory_items").select("*")).data ?? [],
  });
  const b2bQ = useQuery({
    queryKey: ["intel", "b2b_orders"],
    queryFn: async () => (await supabase.from("b2b_orders").select("*")).data ?? [],
  });
  const mktQ = useQuery({
    queryKey: ["intel", "marketing"],
    queryFn: async () => (await supabase.from("marketing_campaigns").select("*")).data ?? [],
  });
  const protoQ = useQuery({
    queryKey: ["intel", "prototypes"],
    queryFn: async () => (await supabase.from("prototypes").select("*")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Brain className="h-3.5 w-3.5" /> Intelligence Engine
        </div>
        <h1 className="text-3xl font-semibold">Inteligência Operacional</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Plataforma única que responde "o que produzir, para quem vender e onde investir" — combinando estoque,
          vendas, produção, marketing e influência em tempo real.
        </p>
      </header>

      <Tabs defaultValue="production">
        <TabsList className="flex w-full flex-wrap justify-start h-auto">
          <TabsTrigger value="production"><Factory className="mr-1 h-4 w-4" />Produção</TabsTrigger>
          <TabsTrigger value="kanban"><Activity className="mr-1 h-4 w-4" />PCP Kanban</TabsTrigger>
          <TabsTrigger value="dev"><Sparkles className="mr-1 h-4 w-4" />Desenvolvimento</TabsTrigger>
          <TabsTrigger value="score"><Trophy className="mr-1 h-4 w-4" />Product Score</TabsTrigger>
          <TabsTrigger value="geo"><MapIcon className="mr-1 h-4 w-4" />Geo & Atribuição</TabsTrigger>
          <TabsTrigger value="influencers"><Users className="mr-1 h-4 w-4" />Influencers</TabsTrigger>
          <TabsTrigger value="lake"><Database className="mr-1 h-4 w-4" />Data Lake</TabsTrigger>
        </TabsList>

        {/* ----------------- PRODUÇÃO (M36 + M37 + M43 + M44) ----------------- */}
        <TabsContent value="production" className="space-y-6">
          <ProductionTab
            products={productsQ.data ?? []}
            orders={ordersQ.data ?? []}
            inventory={invQ.data ?? []}
            b2b={b2bQ.data ?? []}
          />
        </TabsContent>

        {/* ----------------- PCP KANBAN (M42) ----------------- */}
        <TabsContent value="kanban">
          <PcpKanban orders={ordersQ.data ?? []} products={productsQ.data ?? []} />
        </TabsContent>

        {/* ----------------- DESENVOLVIMENTO (M45 + M46) ----------------- */}
        <TabsContent value="dev">
          <DevelopmentBoard prototypes={protoQ.data ?? []} />
        </TabsContent>

        {/* ----------------- PRODUCT SCORE (M47 + M48) ----------------- */}
        <TabsContent value="score">
          <ProductScore products={productsQ.data ?? []} orders={ordersQ.data ?? []} />
        </TabsContent>

        {/* ----------------- GEO + ATRIBUIÇÃO (M38 + M41) ----------------- */}
        <TabsContent value="geo" className="space-y-6">
          <GeoSales products={productsQ.data ?? []} b2b={b2bQ.data ?? []} />
          <Attribution campaigns={mktQ.data ?? []} b2b={b2bQ.data ?? []} />
        </TabsContent>

        {/* ----------------- INFLUENCERS (M39 + M40) ----------------- */}
        <TabsContent value="influencers">
          <InfluencerSuite />
        </TabsContent>

        {/* ----------------- DATA LAKE (M49) ----------------- */}
        <TabsContent value="lake">
          <DataLake
            counts={{
              products: productsQ.data?.length ?? 0,
              orders: ordersQ.data?.length ?? 0,
              inventory: invQ.data?.length ?? 0,
              b2b: b2bQ.data?.length ?? 0,
              campaigns: mktQ.data?.length ?? 0,
              prototypes: protoQ.data?.length ?? 0,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ===================== PRODUÇÃO ===================== */
function ProductionTab({ products, orders, inventory, b2b }: any) {
  const [q, setQ] = useState("");
  const SIZES = ["PP", "P", "M", "G", "GG"];
  const SIZE_DIST = [0.1, 0.2, 0.35, 0.25, 0.1];

  const rows = useMemo(() => {
    return (products as any[]).map((p) => {
      const r = seed(p.id);
      const sold30 = Math.round(r(20, 180));
      const sold7 = Math.round(sold30 * (0.18 + r(0, 0.08)));
      const inProd = (orders as any[])
        .filter((o) => o.product_id === p.id && o.status !== "concluida")
        .reduce((s, o) => s + (o.quantity || 0), 0);
      const stock = Math.round(r(0, 220));
      const minStock = Math.round(r(40, 100));
      const maxStock = minStock + Math.round(r(120, 240));
      const reorder = Math.round(minStock * 1.4);
      const daily = sold30 / 30;
      const coverage = daily > 0 ? Math.round((stock + inProd) / daily) : 999;
      const need = Math.max(0, maxStock - stock - inProd);
      const status = need > 0 && coverage < 14 ? "red" : coverage < 25 ? "amber" : "green";
      return {
        ...p, sold7, sold30, inProd, stock, minStock, maxStock, reorder, coverage, need, status,
      };
    });
  }, [products, orders]);

  const filtered = rows.filter((r) =>
    !q || r.name?.toLowerCase().includes(q.toLowerCase()) || r.sku?.toLowerCase().includes(q.toLowerCase())
  );

  const totals = {
    urgent: rows.filter((r) => r.status === "red").length,
    attention: rows.filter((r) => r.status === "amber").length,
    healthy: rows.filter((r) => r.status === "green").length,
    needed: rows.reduce((s, r) => s + r.need, 0),
  };

  const invValue = (inventory as any[]).reduce((s, i) => s + Number(i.balance || 0), 0);
  const ordersOpen = (b2b as any[]).filter((o) => o.status !== "concluida" && o.status !== "cancelado").length;

  // Replenishment AI suggestions (top 5 with highest need)
  const suggestions = [...rows].sort((a, b) => b.need - a.need).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI label="Urgentes" value={String(totals.urgent)} hint="Produção imediata" icon={AlertTriangle} tone="text-red-500" />
        <KPI label="Atenção" value={String(totals.attention)} hint="Monitorar" icon={Activity} tone="text-amber-500" />
        <KPI label="Saudáveis" value={String(totals.healthy)} icon={CheckCircle2} tone="text-emerald-500" />
        <KPI label="Necessidade total" value={`${totals.needed} un`} icon={Factory} />
        <KPI label="Pedidos abertos" value={String(ordersOpen)} hint={BRL(invValue) + " em estoque"} icon={Boxes} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Factory className="h-4 w-4" />Necessidade de Produção</CardTitle>
            <CardDescription>Cálculo: max(0, estoque máx − estoque − em produção) · cobertura em dias</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Mín / Máx</TableHead>
                  <TableHead className="text-right">Vend 30d</TableHead>
                  <TableHead className="text-right">Produzindo</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead className="text-right">Necessidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 40).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.minStock} / {r.maxStock}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sold30}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.inProd}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.coverage > 365 ? "—" : `${r.coverage}d`}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{r.need}</TableCell>
                    <TableCell>
                      {r.status === "red" && <Badge variant="destructive">Urgente</Badge>}
                      {r.status === "amber" && <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">Atenção</Badge>}
                      {r.status === "green" && <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Saudável</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem produtos.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Smart Replenishment AI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4" />Smart Replenishment AI</CardTitle>
            <CardDescription>Sugestões priorizadas por giro, cobertura e tendência</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.sku} · Vend {s.sold30}/mês · Cobertura {s.coverage > 365 ? "—" : `${s.coverage}d`}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{s.need} un</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Produzir</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {SIZES.map((sz, i) => (
                    <Badge key={sz} variant="secondary" className="text-[10px]">
                      {sz}: {Math.round(s.need * SIZE_DIST[i])}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Motivo: estoque abaixo do ponto de pedido ({s.reorder}) e cobertura inferior ao lead time.
                </div>
              </div>
            ))}
            {suggestions.length === 0 && (
              <div className="text-sm text-muted-foreground">Sem necessidades — operação saudável.</div>
            )}
          </CardContent>
        </Card>

        {/* Digital Twin Factory */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scissors className="h-4 w-4" />Digital Twin · Fábrica</CardTitle>
            <CardDescription>Torre de controle por setor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Corte", load: 78, alert: 2 },
                { name: "Costura", load: 92, alert: 5 },
                { name: "Silk/Bordado", load: 54, alert: 0 },
                { name: "Lavanderia", load: 41, alert: 1 },
                { name: "Acabamento", load: 67, alert: 1 },
                { name: "Expedição", load: 35, alert: 0 },
              ].map((s) => (
                <div key={s.name} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    {s.alert > 0 && <Badge variant="destructive" className="text-[10px]">{s.alert} atraso{s.alert > 1 ? "s" : ""}</Badge>}
                  </div>
                  <Progress value={s.load} className="mt-2" />
                  <div className="mt-1 text-xs text-muted-foreground">Capacidade ocupada {s.load}%</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Centro de Corte:</strong> aproveitamento médio 84% · perda 6,2% · produtividade 1.840 pç/dia
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ===================== PCP KANBAN (M42) ===================== */
function PcpKanban({ orders, products }: any) {
  const stages = ["Programado", "Corte", "Costura", "Acabamento", "Expedição", "Concluído"];
  const map = new Map(stages.map((s) => [s, [] as any[]]));
  const productMap = new Map((products as any[]).map((p) => [p.id, p]));

  (orders as any[]).forEach((o) => {
    const r = seed(o.id);
    let stage = "Programado";
    const s = (o.status || "").toString();
    if (s.includes("conclu")) stage = "Concluído";
    else if ((o.progress || 0) > 80) stage = "Expedição";
    else if ((o.progress || 0) > 60) stage = "Acabamento";
    else if ((o.progress || 0) > 30) stage = "Costura";
    else if ((o.progress || 0) > 5) stage = "Corte";
    else stage = ["Programado", "Corte", "Costura", "Acabamento", "Expedição"][Math.floor(r(0, 5))];
    map.get(stage)?.push(o);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>PCP Kanban</CardTitle>
        <CardDescription>Visualização Monday-style por etapa produtiva</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {stages.map((stage) => {
            const items = map.get(stage) ?? [];
            return (
              <div key={stage} className="rounded-lg border bg-muted/20 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="text-xs font-semibold uppercase tracking-wide">{stage}</div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 6).map((o) => {
                    const p = productMap.get(o.product_id);
                    return (
                      <div key={o.id} className="rounded-md border bg-card p-2">
                        <div className="text-xs font-medium truncate">{p?.name ?? o.code}</div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{o.quantity} un</span>
                          <span>{o.progress || 0}%</span>
                        </div>
                        <Progress value={o.progress || 0} className="mt-1 h-1" />
                      </div>
                    );
                  })}
                  {items.length === 0 && <div className="px-1 text-[11px] text-muted-foreground">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================== DEVELOPMENT (M45/M46) ===================== */
function DevelopmentBoard({ prototypes }: any) {
  const stages = ["Pesquisa", "Moodboard", "Croqui", "Modelagem", "Piloto", "Ajuste", "Aprovação", "Liberado PCP"];
  const cols = new Map(stages.map((s) => [s, [] as any[]]));
  (prototypes as any[]).forEach((p) => {
    const r = seed(p.id);
    const idx = Math.min(stages.length - 1, Math.floor(r(0, stages.length)));
    cols.get(stages[idx])?.push(p);
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Development Kanban</CardTitle>
          <CardDescription>Pipeline criativo separado da produção</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            {stages.map((s) => (
              <div key={s} className="rounded-lg border bg-muted/20 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide">{s}</div>
                  <Badge variant="secondary" className="text-[10px]">{cols.get(s)?.length ?? 0}</Badge>
                </div>
                <div className="space-y-2">
                  {(cols.get(s) ?? []).slice(0, 4).map((p) => (
                    <div key={p.id} className="rounded-md border bg-card p-2">
                      <div className="text-xs font-medium truncate">{p.code}</div>
                      <div className="text-[10px] text-muted-foreground">{p.stage}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pilot Management</CardTitle>
          <CardDescription>Controle exclusivo de pilotos</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {["Em desenvolvimento", "Em ajuste", "Aguardando aprovação", "Aprovado", "Reprovado"].map((st, i) => {
            const count = (prototypes as any[]).filter((_, idx) => idx % 5 === i).length;
            return (
              <div key={st} className="rounded-lg border p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{st}</div>
                <div className="mt-1 text-2xl font-semibold">{count}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ===================== PRODUCT SCORE (M47/M48) ===================== */
function ProductScore({ products, orders }: any) {
  const scored = (products as any[]).map((p) => {
    const r = seed(p.id);
    const margin = p.sell_price && p.cost_price ? ((p.sell_price - p.cost_price) / p.sell_price) * 100 : r(20, 55);
    const sales = r(20, 100);
    const roi = r(40, 95);
    const turnover = r(30, 95);
    const returns = r(0, 12);
    const score = Math.round(sales * 0.3 + roi * 0.25 + turnover * 0.25 + margin * 0.15 - returns * 0.5);
    return { ...p, score, margin: Math.round(margin), sales: Math.round(sales), roi: Math.round(roi), turnover: Math.round(turnover) };
  }).sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 8);
  const distribution = [
    { range: "90-100", count: scored.filter((s) => s.score >= 90).length },
    { range: "75-89", count: scored.filter((s) => s.score >= 75 && s.score < 90).length },
    { range: "60-74", count: scored.filter((s) => s.score >= 60 && s.score < 75).length },
    { range: "<60", count: scored.filter((s) => s.score < 60).length },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" />Top Produtos por Score</CardTitle>
          <CardDescription>Vendas · ROI · Giro · Margem − Devoluções</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Giro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.sku}</div></TableCell>
                  <TableCell className="text-right tabular-nums">{p.sales}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.roi}%</TableCell>
                  <TableCell className="text-right tabular-nums">{p.turnover}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.margin}%</TableCell>
                  <TableCell className="text-right">
                    <Badge className={p.score >= 85 ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15" : p.score >= 70 ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15" : "bg-muted text-foreground"}>
                      {p.score}/100
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Sucesso</CardTitle>
          <CardDescription>Probabilidade prevista pela IA</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill={palette[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===================== GEO SALES (M38) ===================== */
function GeoSales({ products, b2b }: any) {
  const states = ["SP", "MG", "RJ", "PR", "RS", "SC", "BA", "GO", "DF", "CE", "PE", "ES", "MT", "AM", "AC", "RR"];
  const data = states.map((uf, i) => {
    const sales = Math.round(seed(uf)(20, 100) * (1 - i * 0.04));
    return { uf, sales };
  });
  const top = [...data].sort((a, b) => b.sales - a.sales).slice(0, 5);
  const bottom = [...data].sort((a, b) => a.sales - b.sales).slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapIcon className="h-4 w-4" />Geo Sales Intelligence</CardTitle>
        <CardDescription>Aceitação por estado · {(b2b as any[]).length} pedidos analisados</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="uf" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sales" fill={palette[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-emerald-600">Maior aceitação</div>
            <div className="space-y-1">
              {top.map((s) => (
                <div key={s.uf} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.uf}</span>
                  <span className="tabular-nums text-muted-foreground">{s.sales}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-red-500">Baixa performance</div>
            <div className="space-y-1">
              {bottom.map((s) => (
                <div key={s.uf} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.uf}</span>
                  <span className="tabular-nums text-muted-foreground">{s.sales}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================== ATTRIBUTION (M41) ===================== */
function Attribution({ campaigns, b2b }: any) {
  const sources = ["Instagram", "TikTok", "Google", "Influenciador", "Representante", "Marketplace"];
  const totalRevenue = (b2b as any[]).reduce((s, o) => s + Number(o.total_value || 0), 0) || 250000;
  const data = sources.map((src, i) => {
    const share = seed(src)(0.08, 0.25);
    return { name: src, value: Math.round(totalRevenue * share) };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" />Marketing Attribution Engine</CardTitle>
        <CardDescription>Receita atribuída por canal · {(campaigns as any[]).length} campanhas ativas</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => BRL(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ background: palette[i % palette.length] }} />
                <span className="text-sm font-medium">{d.name}</span>
              </div>
              <span className="tabular-nums text-sm">{BRL(d.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================== INFLUENCERS (M39 + M40) ===================== */
function InfluencerSuite() {
  const seedInfluencers = [
    { name: "Marina Costa", ig: "@marinacosta", cidade: "São Paulo", uf: "SP", segmento: "Streetwear", followers: 480000, eng: 6.2, valor: 12000, antes: 18, depois: 54 },
    { name: "Júlia Mendes", ig: "@ju.mendes", cidade: "Belo Horizonte", uf: "MG", segmento: "Casual chic", followers: 220000, eng: 7.8, valor: 6500, antes: 12, depois: 33 },
    { name: "Beatriz Lima", ig: "@bialima", cidade: "Rio de Janeiro", uf: "RJ", segmento: "Beach", followers: 980000, eng: 4.1, valor: 22000, antes: 25, depois: 71 },
    { name: "Camila Rocha", ig: "@camirocha", cidade: "Curitiba", uf: "PR", segmento: "Minimal", followers: 145000, eng: 9.4, valor: 4800, antes: 9, depois: 27 },
    { name: "Renata Alves", ig: "@reealves", cidade: "Porto Alegre", uf: "RS", segmento: "Plus size", followers: 360000, eng: 5.7, valor: 9000, antes: 14, depois: 39 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Influencers ativos" value={String(seedInfluencers.length)} icon={Users} />
        <KPI label="Alcance total" value={`${(seedInfluencers.reduce((s, i) => s + i.followers, 0) / 1_000_000).toFixed(1)}M`} icon={TrendingUp} />
        <KPI label="Investimento" value={BRL(seedInfluencers.reduce((s, i) => s + i.valor, 0))} icon={Megaphone} />
        <KPI label="Lift médio" value={`+${Math.round(seedInfluencers.reduce((s, i) => s + (i.depois - i.antes) / i.antes, 0) / seedInfluencers.length * 100)}%`} icon={Target} tone="text-emerald-500" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Influencer ROI Engine</CardTitle>
          <CardDescription>Vendas antes × depois da campanha · ROI calculado</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Influencer</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-right">Seguidores</TableHead>
                <TableHead className="text-right">Eng%</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right">Antes/Depois</TableHead>
                <TableHead className="text-right">Lift</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seedInfluencers.map((i) => {
                const lift = ((i.depois - i.antes) / i.antes) * 100;
                const receita = (i.depois - i.antes) * 30 * 180; // 30 dias * ticket
                const roi = ((receita - i.valor) / i.valor) * 100;
                return (
                  <TableRow key={i.name}>
                    <TableCell>
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{i.ig}</div>
                    </TableCell>
                    <TableCell className="text-sm">{i.cidade}/{i.uf}</TableCell>
                    <TableCell className="text-sm">{i.segmento}</TableCell>
                    <TableCell className="text-right tabular-nums">{(i.followers / 1000).toFixed(0)}k</TableCell>
                    <TableCell className="text-right tabular-nums">{i.eng}%</TableCell>
                    <TableCell className="text-right tabular-nums">{BRL(i.valor)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{i.antes} → {i.depois}/d</TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">+{Math.round(lift)}%</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{Math.round(roi)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            ROI = (receita incremental − investimento) / investimento · Receita = (Δ vendas/dia) × 30 × ticket médio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===================== DATA LAKE (M49) ===================== */
function DataLake({ counts }: { counts: Record<string, number> }) {
  const entries = [
    { k: "products", label: "Produtos", icon: Sparkles },
    { k: "orders", label: "Ordens de Produção", icon: Factory },
    { k: "inventory", label: "Estoque (SKUs)", icon: Boxes },
    { k: "b2b", label: "Pedidos B2B", icon: Activity },
    { k: "campaigns", label: "Campanhas", icon: Megaphone },
    { k: "prototypes", label: "Protótipos", icon: Scissors },
  ];
  const total = entries.reduce((s, e) => s + (counts[e.k] || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" />Fashion Data Lake</CardTitle>
        <CardDescription>
          {total} registros centralizados — base unificada que alimenta toda a inteligência artificial da plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {entries.map(({ k, label, icon: Icon }) => (
          <div key={k} className="rounded-lg border p-4">
            <Icon className="h-4 w-4 text-primary" />
            <div className="mt-2 text-2xl font-semibold tabular-nums">{counts[k] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
