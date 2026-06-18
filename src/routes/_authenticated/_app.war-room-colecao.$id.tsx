import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  Radio, Layers, Scissors, FileWarning, CheckCircle2, Factory, TrendingUp, AlertTriangle, ArrowLeft, Timer, ShieldAlert,
} from "lucide-react";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/war-room-colecao/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `War Room · Coleção · USE MODA PLM` },
      { name: "description", content: `Sala de guerra da coleção ${params.id}` },
    ],
  }),
  component: WarRoomColecao,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Falha ao carregar coleção: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Coleção não encontrada</div>,
});

type Collection = { id: string; name: string; season: string | null; year: number | null; status: string; progress: number | null };
type Product = { id: string; name: string; sku: string; status: string };
type Prototype = { id: string; product_id: string | null; stage: string; code: string };
type Order = { id: string; product_id: string | null; stage: string; status: string; quantity: number; due_date: string | null };
type Sale = { product_id: string | null; quantity: number; total: number | null };
type Sheet = { product_id: string | null; status: string };

async function loadCollection(id: string) {
  const [col, prods, protos, orders, sales, sheets] = await Promise.all([
    supabase.from("collections").select("id, name, season, year, status, progress").eq("id", id).maybeSingle(),
    supabase.from("products").select("id, name, sku, status").eq("collection_id", id).limit(500),
    supabase.from("prototypes").select("id, product_id, stage, code").limit(2000),
    supabase.from("production_orders").select("id, product_id, stage, status, quantity, due_date").neq("status", "cancelada").limit(2000),
    supabase.from("sales").select("product_id, quantity, total").limit(5000),
    supabase.from("tech_sheets").select("product_id, status").limit(2000),
  ]);
  return {
    collection: (col.data ?? null) as Collection | null,
    products: (prods.data ?? []) as Product[],
    prototypes: (protos.data ?? []) as Prototype[],
    orders: (orders.data ?? []) as Order[],
    sales: (sales.data ?? []) as Sale[],
    sheets: (sheets.data ?? []) as Sheet[],
  };
}

function WarRoomColecao() {
  const { id } = useParams({ from: "/_authenticated/_app/war-room-colecao/$id" });
  useRealtime("production_orders", ["war-room-colecao", id]);
  const { data, isLoading } = useQuery({ queryKey: ["war-room-colecao", id], queryFn: () => loadCollection(id) });

  const c = data?.collection;
  const productIds = useMemo(() => new Set((data?.products ?? []).map((p) => p.id)), [data]);
  const cProtos = (data?.prototypes ?? []).filter((p) => p.product_id && productIds.has(p.product_id));
  const cOrders = (data?.orders ?? []).filter((o) => o.product_id && productIds.has(o.product_id));
  const cSales = (data?.sales ?? []).filter((s) => s.product_id && productIds.has(s.product_id));
  const sheetByProduct = new Map((data?.sheets ?? []).map((s) => [s.product_id, s.status]));

  const inDev = (data?.products ?? []).filter((p) => !p.status || /dev|brief|model|prot/i.test(p.status));
  const semFicha = (data?.products ?? []).filter((p) => sheetByProduct.get(p.id) !== "aprovada");
  const pilotosPend = cProtos.filter((p) => /solicit|em_prova|ajuste|pend/i.test(p.stage ?? ""));
  const liberados = cProtos.filter((p) => /aprov/i.test(p.stage ?? ""));
  const opsAtivas = cOrders.filter((o) => o.stage !== "entregue");
  const atrasadas = cOrders.filter((o) => o.due_date && new Date(o.due_date).getTime() < Date.now() && o.stage !== "entregue");

  const salesByProduct = new Map<string, number>();
  cSales.forEach((s) => { if (s.product_id) salesByProduct.set(s.product_id, (salesByProduct.get(s.product_id) ?? 0) + s.quantity); });
  const ranked = [...salesByProduct.entries()].sort((a, b) => b[1] - a[1]);
  const campeoes = ranked.slice(0, 3).map(([pid, qty]) => ({ p: data?.products.find((x) => x.id === pid), qty }));
  const criticos = (data?.products ?? []).filter((p) => !salesByProduct.get(p.id)).slice(0, 3);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando War Room…</div>;
  if (!c) return <div className="p-8 text-sm">Coleção não encontrada.</div>;

  const cards = [
    { label: "Produtos em desenvolvimento", value: inDev.length, icon: Layers, to: "/produtos", tone: "info" },
    { label: "Pilotos pendentes", value: pilotosPend.length, icon: Scissors, to: "/pilots", tone: "warning" },
    { label: "Produtos sem ficha aprovada", value: semFicha.length, icon: FileWarning, to: "/ficha-tecnica", tone: "warning" },
    { label: "Pilotos liberados", value: liberados.length, icon: CheckCircle2, to: "/prototipos", tone: "success" },
    { label: "OPs ativas", value: opsAtivas.length, icon: Factory, to: "/pcp-kanban", tone: "info" },
    { label: "OPs atrasadas", value: atrasadas.length, icon: AlertTriangle, to: "/pcp", tone: "danger" },
  ] as const;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/colecoes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="size-3" /> Coleções
          </Link>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Radio className="size-3.5" /> War Room
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{c.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {c.season ?? "—"} {c.year ?? ""} · {c.status} · {c.progress ?? 0}% concluído
          </p>
        </div>
        <Link to="/colecao-360" className="text-xs text-primary hover:underline">Ver Coleção 360º →</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const toneCls =
            card.tone === "danger" ? "text-destructive" :
            card.tone === "warning" ? "text-warning" :
            card.tone === "success" ? "text-success" : "text-info";
          return (
            <Link key={card.label} to={card.to} className="glass rounded-xl p-4 hover:border-primary/40 transition-colors">
              <Icon className={`size-4 ${toneCls}`} />
              <div className="mt-3 text-2xl font-semibold tabular-nums">{card.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{card.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass rounded-xl p-5">
            <div className="text-sm font-semibold flex items-center gap-2 mb-3">
              <TrendingUp className="size-4 text-success" /> Campeões (ERP)
            </div>
            {campeoes.length ? (
              <ul className="space-y-2 text-sm">
                {campeoes.map(({ p, qty }, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{p?.name ?? "—"}</span>
                    <span className="tabular-nums text-muted-foreground">{qty} un</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-muted-foreground">Sem vendas registradas.</div>}
          </div>
          <div className="glass rounded-xl p-5">
            <div className="text-sm font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-destructive" /> Sem giro
            </div>
            {criticos.length ? (
              <ul className="space-y-2 text-sm">
                {criticos.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">{p.sku}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-muted-foreground">Todos os produtos têm giro.</div>}
          </div>
        </div>
        <AICoordinatorPanel
          persona="development"
          title="Coordenador · sala de guerra"
          question={`Coleção "${c.name}" (${c.year ?? ""}). ${inDev.length} produtos em dev, ${semFicha.length} sem ficha, ${pilotosPend.length} pilotos pendentes, ${opsAtivas.length} OPs ativas, ${atrasadas.length} atrasadas. Quais 3 ações priorizar AGORA e por quê?`}
        />
      </div>
    </div>
  );
}
