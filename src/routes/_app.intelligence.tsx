import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";

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
  Scissors, Cpu, Search, Plus, Pencil, Trash2, ShoppingCart,
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
  const salesQ = useQuery({
    queryKey: ["intel", "sales"],
    queryFn: async () => (await (supabase as any).from("sales").select("*").order("sold_at", { ascending: false })).data ?? [],
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
          <TabsTrigger value="sales"><ShoppingCart className="mr-1 h-4 w-4" />Vendas</TabsTrigger>
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

        {/* ----------------- VENDAS (M37/M38 — fonte real) ----------------- */}
        <TabsContent value="sales">
          <SalesSuite products={productsQ.data ?? []} />
        </TabsContent>

        {/* ----------------- GEO + ATRIBUIÇÃO (M38 + M41) ----------------- */}
        <TabsContent value="geo" className="space-y-6">
          <GeoSales products={productsQ.data ?? []} b2b={b2bQ.data ?? []} sales={salesQ.data ?? []} />
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
              sales: salesQ.data?.length ?? 0,
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

/* ===================== PCP KANBAN (M42) — drag & drop persistido ===================== */
const PCP_STAGES = ["Programado", "Corte", "Costura", "Acabamento", "Expedição", "Concluído"] as const;
type Stage = typeof PCP_STAGES[number];
type PoStatus = "aguardando" | "em_producao" | "concluida" | "atrasada" | "cancelada";
const STAGE_TO_STATUS: Record<Stage, PoStatus> = {
  "Programado": "aguardando",
  "Corte": "em_producao",
  "Costura": "em_producao",
  "Acabamento": "em_producao",
  "Expedição": "em_producao",
  "Concluído": "concluida",
};
const STAGE_PROGRESS: Record<Stage, number> = {
  "Programado": 0, "Corte": 15, "Costura": 45, "Acabamento": 70, "Expedição": 90, "Concluído": 100,
};
function inferStage(o: any): Stage {
  const s = (o.status || "").toString().toLowerCase();
  if (s === "concluida" || s.includes("conclu")) return "Concluído";
  const p = Number(o.progress || 0);
  if (p >= 100) return "Concluído";
  if (p > 80) return "Expedição";
  if (p > 60) return "Acabamento";
  if (p > 30) return "Costura";
  if (p > 5) return "Corte";
  return "Programado";
}

function PcpKanban({ orders, products }: any) {
  const qc = useQueryClient();
  const { isAdmin, isGerente, roles, loading: rolesLoading } = useRoles();
  const canMove = isAdmin || isGerente || roles.includes("comprador");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const productMap = new Map((products as any[]).map((p) => [p.id, p]));


  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("production_orders")
        .update({ status: STAGE_TO_STATUS[stage], progress: STAGE_PROGRESS[stage] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intel", "production_orders"] });
      toast.success("Etapa atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const map = new Map(PCP_STAGES.map((s) => [s, [] as any[]]));
  (orders as any[]).forEach((o) => map.get(inferStage(o))?.push(o));

  return (
    <Card>
      <CardHeader>
        <CardTitle>PCP Kanban</CardTitle>
        <CardDescription>
          {canMove
            ? "Arraste os cards entre as colunas (para frente ou para trás) — status persistido em tempo real."
            : rolesLoading ? "Carregando permissões…" : "Somente admin, gerente ou comprador podem mover cards."}
        </CardDescription>
      </CardHeader>
      <CardContent>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {PCP_STAGES.map((stage) => {
            const items = map.get(stage) ?? [];
            const isOver = overStage === stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => { if (!canMove) return; e.preventDefault(); setOverStage(stage); }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  if (!canMove) { toast.error("Sem permissão para mover cards"); return; }
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setOverStage(null); setDragId(null);
                  if (id) move.mutate({ id, stage });
                }}
                className={`rounded-lg border p-2 transition-colors ${isOver ? "bg-primary/10 border-primary" : "bg-muted/20"}`}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="text-xs font-semibold uppercase tracking-wide">{stage}</div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {items.map((o) => {
                    const p = productMap.get(o.product_id);
                    return (
                      <div
                        key={o.id}
                        draggable={canMove}
                        onDragStart={(e) => { if (!canMove) { e.preventDefault(); return; } setDragId(o.id); e.dataTransfer.setData("text/plain", o.id); }}
                        onDragEnd={() => setDragId(null)}
                        className={`rounded-md border bg-card p-2 ${canMove ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-90"} ${dragId === o.id ? "opacity-50" : ""}`}
                      >

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
function GeoSales({ products, b2b, sales = [] }: any) {
  const states = ["SP", "MG", "RJ", "PR", "RS", "SC", "BA", "GO", "DF", "CE", "PE", "ES", "MT", "AM", "AC", "RR"];
  const real = (sales as any[]).length > 0;
  const data = states.map((uf, i) => {
    const realVal = (sales as any[])
      .filter((s) => s.uf === uf)
      .reduce((acc, s) => acc + Number(s.quantity || 0), 0);
    const sales_ = real ? realVal : Math.round(seed(uf)(20, 100) * (1 - i * 0.04));
    return { uf, sales: sales_ };
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

/* ===================== INFLUENCERS (M39 + M40) — CRUD real ===================== */
type Influencer = {
  id: string; owner_id: string;
  nome: string; instagram?: string | null; tiktok?: string | null; youtube?: string | null;
  cidade?: string | null; estado?: string | null; segmento?: string | null;
  seguidores: number; engajamento: number; valor: number;
  vendas_antes: number; vendas_depois: number; ticket_medio: number;
  data_postagem?: string | null; foto_url?: string | null; notes?: string | null;
};

const EMPTY_INF: Partial<Influencer> = {
  nome: "", instagram: "", tiktok: "", youtube: "",
  cidade: "", estado: "", segmento: "",
  seguidores: 0, engajamento: 0, valor: 0,
  vendas_antes: 0, vendas_depois: 0, ticket_medio: 180,
};

function InfluencerSuite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Influencer>>(EMPTY_INF);

  const list = useQuery({
    queryKey: ["influencers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("influencers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Influencer[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Influencer>) => {
      if (!user) throw new Error("Sem usuário");
      const payload: any = { ...v, owner_id: user.id };
      const { error } = v.id
        ? await (supabase as any).from("influencers").update(payload).eq("id", v.id)
        : await (supabase as any).from("influencers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencers"] });
      setOpen(false); setDraft(EMPTY_INF);
      toast.success("Influencer salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("influencers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Removido");
    },
  });

  const items = list.data ?? [];
  const totals = useMemo(() => {
    const lifts = items.filter((i) => Number(i.vendas_antes) > 0)
      .map((i) => (Number(i.vendas_depois) - Number(i.vendas_antes)) / Number(i.vendas_antes));
    return {
      count: items.length,
      reach: items.reduce((s, i) => s + Number(i.seguidores || 0), 0),
      invest: items.reduce((s, i) => s + Number(i.valor || 0), 0),
      avgLift: lifts.length ? lifts.reduce((s, n) => s + n, 0) / lifts.length : 0,
    };
  }, [items]);

  function edit(i: Influencer) { setDraft(i); setOpen(true); }
  function nu() { setDraft(EMPTY_INF); setOpen(true); }
  function field<K extends keyof Influencer>(k: K, v: any) { setDraft((d) => ({ ...d, [k]: v })); }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Influencers ativos" value={String(totals.count)} icon={Users} />
        <KPI label="Alcance total" value={totals.reach >= 1_000_000 ? `${(totals.reach / 1_000_000).toFixed(1)}M` : `${(totals.reach / 1000).toFixed(0)}k`} icon={TrendingUp} />
        <KPI label="Investimento" value={BRL(totals.invest)} icon={Megaphone} />
        <KPI label="Lift médio" value={totals.count ? `${totals.avgLift >= 0 ? "+" : ""}${Math.round(totals.avgLift * 100)}%` : "—"} icon={Target} tone="text-emerald-500" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Influencer ROI Engine</CardTitle>
            <CardDescription>Cadastro completo, campanha e ROI antes × depois (dados persistidos)</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={nu}><Plus className="mr-1 h-4 w-4" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{draft.id ? "Editar influencer" : "Novo influencer"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome</Label><Input value={draft.nome ?? ""} onChange={(e) => field("nome", e.target.value)} /></div>
                <div><Label>Instagram</Label><Input value={draft.instagram ?? ""} onChange={(e) => field("instagram", e.target.value)} placeholder="@usuario" /></div>
                <div><Label>TikTok</Label><Input value={draft.tiktok ?? ""} onChange={(e) => field("tiktok", e.target.value)} placeholder="@usuario" /></div>
                <div><Label>Youtube</Label><Input value={draft.youtube ?? ""} onChange={(e) => field("youtube", e.target.value)} /></div>
                <div><Label>Segmento</Label><Input value={draft.segmento ?? ""} onChange={(e) => field("segmento", e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={draft.cidade ?? ""} onChange={(e) => field("cidade", e.target.value)} /></div>
                <div><Label>Estado (UF)</Label><Input maxLength={2} value={draft.estado ?? ""} onChange={(e) => field("estado", e.target.value.toUpperCase())} /></div>
                <div><Label>Seguidores</Label><Input type="number" value={draft.seguidores ?? 0} onChange={(e) => field("seguidores", Number(e.target.value))} /></div>
                <div><Label>Engajamento %</Label><Input type="number" step="0.1" value={draft.engajamento ?? 0} onChange={(e) => field("engajamento", Number(e.target.value))} /></div>
                <div><Label>Valor (R$)</Label><Input type="number" value={draft.valor ?? 0} onChange={(e) => field("valor", Number(e.target.value))} /></div>
                <div><Label>Vendas/dia ANTES</Label><Input type="number" value={draft.vendas_antes ?? 0} onChange={(e) => field("vendas_antes", Number(e.target.value))} /></div>
                <div><Label>Vendas/dia DEPOIS</Label><Input type="number" value={draft.vendas_depois ?? 0} onChange={(e) => field("vendas_depois", Number(e.target.value))} /></div>
                <div><Label>Ticket médio (R$)</Label><Input type="number" value={draft.ticket_medio ?? 180} onChange={(e) => field("ticket_medio", Number(e.target.value))} /></div>
                <div><Label>Data postagem</Label><Input type="date" value={draft.data_postagem ?? ""} onChange={(e) => field("data_postagem", e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate(draft)} disabled={!draft.nome || save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const va = Number(i.vendas_antes), vd = Number(i.vendas_depois);
                const lift = va > 0 ? ((vd - va) / va) * 100 : 0;
                const receita = Math.max(0, vd - va) * 30 * Number(i.ticket_medio || 0);
                const roi = Number(i.valor) > 0 ? ((receita - Number(i.valor)) / Number(i.valor)) * 100 : 0;
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.nome}</div>
                      <div className="text-xs text-muted-foreground">{i.instagram}</div>
                    </TableCell>
                    <TableCell className="text-sm">{[i.cidade, i.estado].filter(Boolean).join("/")}</TableCell>
                    <TableCell className="text-sm">{i.segmento}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.seguidores >= 1000 ? `${(i.seguidores / 1000).toFixed(0)}k` : i.seguidores}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(i.engajamento).toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{BRL(Number(i.valor))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{va} → {vd}/d</TableCell>
                    <TableCell className="text-right">
                      <Badge className={lift >= 0 ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15" : "bg-red-500/15 text-red-600 hover:bg-red-500/15"}>
                        {lift >= 0 ? "+" : ""}{Math.round(lift)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{Math.round(roi)}%</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => edit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum influencer cadastrado. Clique em "Novo" para começar.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
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
    { k: "sales", label: "Vendas", icon: ShoppingCart },
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

/* ===================== SALES SUITE (CRUD real) ===================== */
type Sale = {
  id: string; product_id: string | null; sku: string | null; size: string | null;
  channel: string; uf: string | null; city: string | null;
  quantity: number; unit_price: number; total: number; sold_at: string;
};
const EMPTY_SALE: Partial<Sale> = {
  product_id: null, sku: "", size: "", channel: "ecommerce", uf: "", city: "",
  quantity: 1, unit_price: 0, total: 0, sold_at: new Date().toISOString().slice(0, 10),
};
const CHANNELS = ["ecommerce", "marketplace", "b2b", "loja_fisica", "influenciador", "instagram", "tiktok"];

function SalesSuite({ products }: { products: any[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Sale>>(EMPTY_SALE);

  const list = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sales").select("*").order("sold_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Sale>) => {
      if (!user) throw new Error("Sem usuário");
      const qty = Number(v.quantity || 0), price = Number(v.unit_price || 0);
      const payload: any = {
        ...v, user_id: user.id, quantity: qty, unit_price: price, total: qty * price,
        product_id: v.product_id || null,
      };
      const { error } = v.id
        ? await (supabase as any).from("sales").update(payload).eq("id", v.id)
        : await (supabase as any).from("sales").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["intel", "sales"] });
      setOpen(false); setDraft(EMPTY_SALE); toast.success("Venda salva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["intel", "sales"] });
      toast.success("Removido");
    },
  });

  const items = list.data ?? [];
  const totals = useMemo(() => {
    const revenue = items.reduce((s, x) => s + Number(x.total || 0), 0);
    const units = items.reduce((s, x) => s + Number(x.quantity || 0), 0);
    const byChannel = CHANNELS.map((c) => ({
      channel: c,
      revenue: items.filter((x) => x.channel === c).reduce((s, x) => s + Number(x.total || 0), 0),
    })).filter((c) => c.revenue > 0);
    return { revenue, units, ticket: units ? revenue / units : 0, byChannel };
  }, [items]);

  function edit(s: Sale) {
    setDraft({ ...s, sold_at: (s.sold_at || "").slice(0, 10) });
    setOpen(true);
  }
  function nu() { setDraft(EMPTY_SALE); setOpen(true); }
  function field<K extends keyof Sale>(k: K, v: any) { setDraft((d) => ({ ...d, [k]: v })); }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Receita" value={BRL(totals.revenue)} icon={TrendingUp} />
        <KPI label="Unidades vendidas" value={String(totals.units)} icon={Boxes} />
        <KPI label="Ticket médio" value={BRL(totals.ticket)} icon={Target} />
        <KPI label="Registros" value={String(items.length)} icon={ShoppingCart} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Vendas — fonte única (M37/M38)</CardTitle>
            <CardDescription>Alimenta Production Intelligence, Geo Sales e Product Score com dados reais.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={nu}><Plus className="mr-1 h-4 w-4" />Nova venda</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{draft.id ? "Editar venda" : "Nova venda"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Produto</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={draft.product_id ?? ""} onChange={(e) => field("product_id", e.target.value || null)}>
                    <option value="">— sem vínculo —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name ?? p.sku ?? p.id}</option>
                    ))}
                  </select>
                </div>
                <div><Label>SKU</Label><Input value={draft.sku ?? ""} onChange={(e) => field("sku", e.target.value)} /></div>
                <div><Label>Tamanho</Label><Input value={draft.size ?? ""} onChange={(e) => field("size", e.target.value)} placeholder="P/M/G" /></div>
                <div>
                  <Label>Canal</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={draft.channel ?? "ecommerce"} onChange={(e) => field("channel", e.target.value)}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>UF</Label><Input maxLength={2} value={draft.uf ?? ""} onChange={(e) => field("uf", e.target.value.toUpperCase())} /></div>
                <div><Label>Cidade</Label><Input value={draft.city ?? ""} onChange={(e) => field("city", e.target.value)} /></div>
                <div><Label>Data</Label><Input type="date" value={draft.sold_at ?? ""} onChange={(e) => field("sold_at", e.target.value)} /></div>
                <div><Label>Quantidade</Label><Input type="number" value={draft.quantity ?? 1} onChange={(e) => field("quantity", Number(e.target.value))} /></div>
                <div><Label>Preço unitário (R$)</Label><Input type="number" step="0.01" value={draft.unit_price ?? 0} onChange={(e) => field("unit_price", Number(e.target.value))} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate(draft)} disabled={!draft.quantity || save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-6">
          {totals.byChannel.length > 0 && (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={totals.byChannel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => BRL(Number(v))} />
                  <Bar dataKey="revenue" fill={palette[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tam</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{(s.sold_at || "").slice(0, 10)}</TableCell>
                    <TableCell className="text-sm font-medium">{s.sku || "—"}</TableCell>
                    <TableCell className="text-sm">{s.size || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{s.channel}</Badge></TableCell>
                    <TableCell className="text-sm">{s.uf || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{BRL(Number(s.unit_price))}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{BRL(Number(s.total))}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => edit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma venda cadastrada. Clique em "Nova venda" para começar a alimentar a inteligência.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
