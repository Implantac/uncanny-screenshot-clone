import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  Compass,
  Layers,
  Scissors,
  Factory,
  TrendingUp,
  Percent,
  DollarSign,
  Package,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  FileWarning,
  Clock,
  CheckCircle2,
  Radio,
  Wallet,
  Database,
  Loader2,
  RefreshCw,
  Boxes,
  Gauge,
} from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";
import { Target, Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/colecao-360")({
  head: () => ({
    meta: [
      { title: "Coleção 360º · USE MODA PLM" },
      {
        name: "description",
        content: "Visão única da coleção: protótipos, produtos, OPs, vendas e margem.",
      },
    ],
  }),
  component: Colecao360,
});

type CollectionAggregate = {
  collection: { id: string; name: string };
  productCount: number;
  protoCount: number;
  protoApproved: number;
  opsActive: number;
  opsDone: number;
  producedQty: number;
  revenue: number;
  unitsSold: number;
  margin: number;
  sellThrough: number;
  investment: number;
  productionCost: number;
  marketingCost: number;
  profit: number;
  roi: number;
  semPiloto: number;
  protoPendentes: number;
  opsAguardando: number;
  liberadosPCP: number;
  avanco: number;
  semFicha: number;
  stockUnits: number;
  stockValue: number;
  coverageDays: number | null;
  dailyVelocity: number;
  ruptureSkus: Array<{ id: string; sku: string; name: string }>;
  excessSkus: Array<{ p: { id: string; sku: string; name: string }; stock: number; days: number }>;
  dataSource: string;
  champions: Array<{ p: { id: string; sku: string; name: string }; rev: number }>;
  criticos: Array<{ p: { id: string; sku: string; name: string }; rev: number }>;
};

type Collection = {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  status: string;
  target_revenue?: number | null;
  target_pieces?: number | null;
  target_margin_pct?: number | null;
};
type Product = {
  id: string;
  collection_id: string | null;
  name: string;
  sku: string;
  status: string;
  cost_price: number | null;
  sell_price: number | null;
};
type Prototype = { id: string; product_id: string | null; stage: string };
type Order = {
  id: string;
  product_id: string | null;
  stage: string;
  status: string;
  quantity: number;
};
type Sale = { product_id: string | null; quantity: number; total: number | null };
type ErpSale = {
  sku: string | null;
  product_ref: string | null;
  quantity: number | null;
  total_value: number | null;
  sold_at: string | null;
};
type InventoryRow = { sku: string | null; balance: number | null };

type Sheet = { product_id: string | null; status: string };
type Campaign = {
  collection_id: string | null;
  cost_shoot: number | null;
  cost_photos: number | null;
  cost_traffic: number | null;
};

async function loadAll() {
  const results = await Promise.all([
    supabase
      .from("collections")
      .select("id, name, season, year, status, target_revenue, target_pieces, target_margin_pct")
      .order("year", { ascending: false })
      .limit(50),
    supabase
      .from("products")
      .select("id, collection_id, name, sku, status, cost_price, sell_price")
      .limit(1000),
    supabase.from("prototypes").select("id, product_id, stage").limit(1000),
    supabase
      .from("production_orders")
      .select("id, product_id, stage, status, quantity")
      .neq("status", "cancelada")
      .limit(1000),
    supabase.from("sales").select("product_id, quantity, total").limit(5000),
    supabase
      .from("erp_sales_mirror")
      .select("sku, product_ref, quantity, total_value, sold_at")
      .limit(20000),
    supabase.from("erp_inventory_mirror").select("sku, balance").limit(5000),
    supabase.from("inventory_items").select("sku, balance").limit(5000),
    supabase.from("tech_sheets").select("product_id, status").limit(2000),
    supabase
      .from("marketing_campaigns")
      .select("collection_id, cost_shoot, cost_photos, cost_traffic")
      .limit(1000),
  ]);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);
  const [
    collections,
    products,
    prototypes,
    orders,
    sales,
    erpSales,
    erpInventory,
    inventory,
    sheets,
    campaigns,
  ] = results;
  return {
    collections: (collections.data ?? []) as Collection[],
    products: (products.data ?? []) as Product[],
    prototypes: (prototypes.data ?? []) as Prototype[],
    orders: (orders.data ?? []) as Order[],
    sales: (sales.data ?? []) as Sale[],
    erpSales: (erpSales.data ?? []) as ErpSale[],
    erpInventory: (erpInventory.data ?? []) as InventoryRow[],
    inventory: (inventory.data ?? []) as InventoryRow[],
    sheets: (sheets.data ?? []) as Sheet[],
    campaigns: (campaigns.data ?? []) as Campaign[],
  };
}

function Colecao360() {
  useRealtime("production_orders", ["colecao-360"]);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["colecao-360"],
    queryFn: loadAll,
  });
  const collections = useMemo(() => data?.collections ?? [], [data?.collections]);
  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const prototypes = useMemo(() => data?.prototypes ?? [], [data?.prototypes]);
  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const sales = useMemo(() => data?.sales ?? [], [data?.sales]);
  const erpSales = useMemo(() => data?.erpSales ?? [], [data?.erpSales]);
  const erpInventory = useMemo(() => data?.erpInventory ?? [], [data?.erpInventory]);
  const inventory = useMemo(() => data?.inventory ?? [], [data?.inventory]);
  const sheets = useMemo(() => data?.sheets ?? [], [data?.sheets]);
  const campaigns = useMemo(() => data?.campaigns ?? [], [data?.campaigns]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentId = selectedId ?? collections[0]?.id ?? null;

  const summary = useMemo(() => {
    return collections.map((c) => {
      const cProducts = products.filter((p) => p.collection_id === c.id);
      const productIds = new Set(cProducts.map((p) => p.id));
      const cProtos = prototypes.filter((p) => p.product_id && productIds.has(p.product_id));
      const cOrders = orders.filter((o) => o.product_id && productIds.has(o.product_id));
      const productBySku = new Map(cProducts.map((p) => [p.sku.trim().toLowerCase(), p]));
      const productByName = new Map(cProducts.map((p) => [p.name.trim().toLowerCase(), p]));
      const cLegacySales = sales.filter((s) => s.product_id && productIds.has(s.product_id));
      const cErpSales = erpSales.filter((s) => {
        const sku = s.sku?.trim().toLowerCase();
        const ref = s.product_ref?.trim().toLowerCase();
        return Boolean((sku && productBySku.has(sku)) || (ref && productByName.has(ref)));
      });
      const useErpSales = cErpSales.length > 0;

      const revenue = useErpSales
        ? cErpSales.reduce((a, s) => a + Number(s.total_value ?? 0), 0)
        : cLegacySales.reduce((a, s) => a + Number(s.total ?? 0), 0);
      const unitsSold = useErpSales
        ? cErpSales.reduce((a, s) => a + Number(s.quantity ?? 0), 0)
        : cLegacySales.reduce((a, s) => a + s.quantity, 0);
      const opsActive = cOrders.filter((o) => o.stage !== "entregue").length;
      const opsDone = cOrders.filter((o) => o.stage === "entregue").length;
      const producedQty = cOrders
        .filter((o) => o.stage === "entregue")
        .reduce((a, o) => a + o.quantity, 0);

      const avgCost = cProducts.length
        ? cProducts.reduce((a, p) => a + Number(p.cost_price ?? 0), 0) / cProducts.length
        : 0;
      const avgPrice = cProducts.length
        ? cProducts.reduce((a, p) => a + Number(p.sell_price ?? 0), 0) / cProducts.length
        : 0;
      const margin = avgPrice > 0 ? ((avgPrice - avgCost) / avgPrice) * 100 : 0;
      const sellThrough = producedQty > 0 ? (unitsSold / producedQty) * 100 : 0;

      const stockBySku = new Map<string, number>();
      erpInventory.forEach((row) => {
        const sku = row.sku?.trim();
        if (!sku) return;
        stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + Number(row.balance ?? 0));
      });
      inventory.forEach((row) => {
        const sku = row.sku?.trim();
        if (!sku || stockBySku.has(sku)) return;
        stockBySku.set(sku, Number(row.balance ?? 0));
      });
      const stockUnits = cProducts.reduce((sum, p) => sum + (stockBySku.get(p.sku) ?? 0), 0);
      const stockValue = cProducts.reduce(
        (sum, p) => sum + (stockBySku.get(p.sku) ?? 0) * Number(p.cost_price ?? 0),
        0,
      );
      const salesByProduct = new Map<
        string,
        { units: number; revenue: number; recent30: number }
      >();
      const since30 = Date.now() - 30 * 86400000;
      if (useErpSales) {
        cErpSales.forEach((s) => {
          const sku = s.sku?.trim().toLowerCase();
          const ref = s.product_ref?.trim().toLowerCase();
          const product = (sku && productBySku.get(sku)) || (ref && productByName.get(ref));
          if (!product) return;
          const cur = salesByProduct.get(product.id) ?? { units: 0, revenue: 0, recent30: 0 };
          const qty = Number(s.quantity ?? 0);
          cur.units += qty;
          cur.revenue += Number(s.total_value ?? 0);
          if (s.sold_at && new Date(s.sold_at).getTime() >= since30) cur.recent30 += qty;
          salesByProduct.set(product.id, cur);
        });
      } else {
        cLegacySales.forEach((s) => {
          if (!s.product_id) return;
          const cur = salesByProduct.get(s.product_id) ?? { units: 0, revenue: 0, recent30: 0 };
          cur.units += s.quantity;
          cur.revenue += Number(s.total ?? 0);
          cur.recent30 += s.quantity;
          salesByProduct.set(s.product_id, cur);
        });
      }
      const dailyVelocity =
        [...salesByProduct.values()].reduce((sum, s) => sum + s.recent30, 0) / 30;
      const coverageDays = dailyVelocity > 0 ? Math.round(stockUnits / dailyVelocity) : null;
      const ruptureSkus = cProducts
        .filter(
          (p) => (stockBySku.get(p.sku) ?? 0) <= 0 && (salesByProduct.get(p.id)?.units ?? 0) > 0,
        )
        .slice(0, 5);
      const excessSkus = cProducts
        .map((p) => {
          const stock = stockBySku.get(p.sku) ?? 0;
          const recent = salesByProduct.get(p.id)?.recent30 ?? 0;
          const days = recent > 0 ? Math.round(stock / (recent / 30)) : stock > 0 ? 999 : 0;
          return { p, stock, days };
        })
        .filter((row) => row.stock > 0 && row.days > 120)
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 5);

      // Investimento × Resultado (produção + marketing × receita ERP)
      const productionCost = cOrders.reduce((a, o) => {
        const p = cProducts.find((pr) => pr.id === o.product_id);
        return a + Number(p?.cost_price ?? avgCost) * o.quantity;
      }, 0);
      const marketingCost = campaigns
        .filter((cp) => cp.collection_id === c.id)
        .reduce(
          (a, cp) =>
            a +
            Number(cp.cost_shoot ?? 0) +
            Number(cp.cost_photos ?? 0) +
            Number(cp.cost_traffic ?? 0),
          0,
        );
      const investment = productionCost + marketingCost;
      const profit = revenue - investment;
      const roi = investment > 0 ? (profit / investment) * 100 : 0;

      // Sala de Guerra — derivados
      const productsWithApprovedProto = new Set(
        cProtos.filter((p) => p.stage === "aprovado" && p.product_id).map((p) => p.product_id!),
      );
      const semPiloto = cProducts.filter((p) => !productsWithApprovedProto.has(p.id)).length;
      const protoPendentes = cProtos.filter(
        (p) => p.stage !== "aprovado" && p.stage !== "reprovado",
      ).length;
      const opsAguardando = cOrders.filter((o) => o.status === "aguardando").length;
      const liberadosPCP = cOrders.filter(
        (o) => o.stage !== "cad" && o.stage !== "entregue",
      ).length;
      const totalQty = cOrders.reduce((a, o) => a + o.quantity, 0);
      const avanco = totalQty > 0 ? (producedQty / totalQty) * 100 : 0;

      const approvedSheetIds = new Set(
        sheets.filter((s) => s.status === "aprovada" && s.product_id).map((s) => s.product_id!),
      );
      const semFicha = cProducts.filter((p) => !approvedSheetIds.has(p.id)).length;

      // Champions e críticos por receita
      const revenuePerProduct = new Map<string, number>();
      salesByProduct.forEach((value, productId) => {
        revenuePerProduct.set(productId, value.revenue);
      });
      const ranked = cProducts
        .map((p) => ({ p, rev: revenuePerProduct.get(p.id) ?? 0 }))
        .sort((a, b) => b.rev - a.rev);
      const champions = ranked.slice(0, 3).filter((x) => x.rev > 0);
      const criticos = ranked.filter((x) => x.rev === 0).slice(0, 3);

      return {
        collection: c,
        productCount: cProducts.length,
        protoCount: cProtos.length,
        protoApproved: cProtos.filter((p) => p.stage === "aprovado").length,
        opsActive,
        opsDone,
        producedQty,
        revenue,
        unitsSold,
        margin,
        sellThrough,
        investment,
        productionCost,
        marketingCost,
        profit,
        roi,
        semPiloto,
        protoPendentes,
        opsAguardando,
        liberadosPCP,
        avanco,
        semFicha,
        stockUnits,
        stockValue,
        coverageDays,
        dailyVelocity,
        ruptureSkus,
        excessSkus,
        dataSource: useErpSales ? "ERP" : "PLM",
        champions,
        criticos,
      };
    });
  }, [
    collections,
    products,
    prototypes,
    orders,
    sales,
    erpSales,
    erpInventory,
    inventory,
    sheets,
    campaigns,
  ]);

  const current = summary.find((s) => s.collection.id === currentId) ?? summary[0];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Compass className="size-6 text-primary" />
            Coleção 360º
          </h1>
          <p className="text-sm text-muted-foreground">
            Ciclo completo da coleção — do protótipo à margem real, em uma única tela.
          </p>
        </div>
        {current && (
          <Link
            to="/war-room-colecao/$id"
            params={{ id: current.collection.id }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Radio className="size-3.5" /> Abrir War Room
          </Link>
        )}
      </header>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 grid place-items-center text-sm text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin text-primary" />
          Carregando coleções…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm space-y-3">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertTriangle className="size-4" /> Não foi possível carregar a Coleção 360º
          </div>
          <div className="text-xs text-muted-foreground wrap-break-word">
            {(error as Error)?.message ?? "Erro desconhecido"}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} /> Tentar novamente
          </button>
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma coleção cadastrada.
          <Link to="/colecoes" className="ml-2 text-primary hover:underline">
            Criar coleção →
          </Link>
        </div>
      ) : (
        <>
          {/* Seletor de coleções */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {summary.map((s) => (
              <button
                key={s.collection.id}
                onClick={() => setSelectedId(s.collection.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg border text-left transition-colors ${
                  s.collection.id === current?.collection.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.collection.season ?? "—"} {s.collection.year ?? ""}
                </div>
                <div className="font-medium text-sm">{s.collection.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {s.productCount} prod · {s.opsActive} OPs
                </div>
              </button>
            ))}
          </div>

          {current && (
            <>
              {/* Pipeline visual */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Pipeline da coleção
                </div>
                <div className="flex items-stretch gap-2 overflow-x-auto">
                  <Stage
                    icon={<Sparkles className="size-4" />}
                    label="Protótipos"
                    value={current.protoCount}
                    sub={`${current.protoApproved} aprovados`}
                    to="/prototipos"
                  />
                  <Arrow />
                  <Stage
                    icon={<Layers className="size-4" />}
                    label="Produtos"
                    value={current.productCount}
                    sub="liberados"
                    to="/produtos"
                  />
                  <Arrow />
                  <Stage
                    icon={<Scissors className="size-4" />}
                    label="OPs ativas"
                    value={current.opsActive}
                    sub={`${current.opsDone} entregues`}
                    to="/pcp-kanban"
                  />
                  <Arrow />
                  <Stage
                    icon={<Factory className="size-4" />}
                    label="Produzido"
                    value={current.producedQty}
                    sub="unidades"
                    to="/twin-factory"
                  />
                  <Arrow />
                  <Stage
                    icon={<Package className="size-4" />}
                    label="Vendido"
                    value={current.unitsSold}
                    sub="unidades"
                    to="/sales-performance"
                  />
                </div>
              </div>

              {/* IA Coordenador — diagnóstico em linguagem natural */}
              <InvestmentResult c={current} />

              <DigitalTwinAggregate c={current} />

              <MetaMood c={current} />

              <div className="grid md:grid-cols-2 gap-3">
                <CoordinatorBriefing c={current} />
                <AICoordinatorPanel
                  persona="marketing"
                  title={`Marketing · ${current.collection.name}`}
                  question={`Para a coleção "${current.collection.name}" (${current.productCount} produtos, receita R$ ${Math.round(current.revenue)}, sell-through ${Math.round(current.sellThrough)}%), quais são as 3 ações de marketing mais eficazes para os próximos 14 dias? Justifique cada uma.`}
                />
              </div>

              {/* Sala de Guerra — sinais operacionais */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Radio className="size-3.5 text-primary" /> Sala de Guerra
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Avanço da produção:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {Math.round(current.avanco)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <WarKPI
                    label="Sem piloto aprovado"
                    value={current.semPiloto}
                    icon={<FileWarning className="size-3.5" />}
                    tone={current.semPiloto > 0 ? "red" : "green"}
                    to="/prototipos"
                  />
                  <WarKPI
                    label="Sem ficha técnica"
                    value={current.semFicha}
                    icon={<FileWarning className="size-3.5" />}
                    tone={current.semFicha > 0 ? "red" : "green"}
                    to="/tech-sheets"
                  />
                  <WarKPI
                    label="Protótipos pendentes"
                    value={current.protoPendentes}
                    icon={<Sparkles className="size-3.5" />}
                    tone={current.protoPendentes > 5 ? "yellow" : "neutral"}
                    to="/dev-kanban"
                  />
                  <WarKPI
                    label="OPs aguardando"
                    value={current.opsAguardando}
                    icon={<Clock className="size-3.5" />}
                    tone={current.opsAguardando > 0 ? "yellow" : "green"}
                    to="/pcp-kanban"
                  />
                  <WarKPI
                    label="Liberados p/ PCP"
                    value={current.liberadosPCP}
                    icon={<CheckCircle2 className="size-3.5" />}
                    tone="primary"
                    to="/pcp-kanban"
                  />
                  <WarKPI
                    label="OPs em atraso"
                    value={Math.max(
                      0,
                      current.opsActive - current.liberadosPCP - current.opsAguardando,
                    )}
                    icon={<AlertTriangle className="size-3.5" />}
                    tone="neutral"
                    to="/twin-factory"
                  />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, current.avanco)}%` }}
                  />
                </div>
              </div>

              {/* Champions e críticos */}
              {(current.champions.length > 0 || current.criticos.length > 0) && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-success/30 bg-card p-4">
                    <div className="text-xs uppercase tracking-wider text-success mb-2 flex items-center gap-1.5">
                      <TrendingUp className="size-3.5" /> Campeões da coleção
                    </div>
                    {current.champions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Sem dados de venda.</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {current.champions.map(({ p, rev }) => (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="truncate">
                              <span className="text-muted-foreground text-xs">{p.sku}</span> ·{" "}
                              {p.name}
                            </span>
                            <span className="tabular-nums font-medium">
                              R$ {(rev / 1000).toFixed(1)}k
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-destructive/30 bg-card p-4">
                    <div className="text-xs uppercase tracking-wider text-destructive mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" /> Críticos (sem venda)
                    </div>
                    {current.criticos.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Todos os produtos têm venda.
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {current.criticos.map(({ p }) => (
                          <li key={p.id} className="flex items-center justify-between text-sm">
                            <span className="truncate">
                              <span className="text-muted-foreground text-xs">{p.sku}</span> ·{" "}
                              {p.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{p.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* KPIs financeiros */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI
                  label="Receita"
                  value={`R$ ${(current.revenue / 1000).toFixed(1)}k`}
                  icon={<DollarSign className="size-4" />}
                  tone="primary"
                />
                <KPI
                  label="Margem média"
                  value={`${Math.round(current.margin)}%`}
                  icon={<Percent className="size-4" />}
                  tone={current.margin >= 40 ? "green" : current.margin >= 20 ? "yellow" : "red"}
                />
                <KPI
                  label="Sell-through"
                  value={`${Math.round(current.sellThrough)}%`}
                  icon={<TrendingUp className="size-4" />}
                  tone={
                    current.sellThrough >= 70
                      ? "green"
                      : current.sellThrough >= 40
                        ? "yellow"
                        : "red"
                  }
                />
                <KPI
                  label="Status"
                  value={current.collection.status}
                  icon={<Compass className="size-4" />}
                  tone="primary"
                />
              </div>

              {/* Atalhos cruzados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Shortcut to="/colecoes" label="Editar coleção" />
                <Shortcut to="/product-score" label="Score por produto" />
                <Shortcut to="/profitability" label="Rentabilidade (ERP)" />
                <Shortcut to="/marketing" label="Marketing da coleção" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stage({
  icon,
  label,
  value,
  sub,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex-1 min-w-[110px] rounded-lg border border-border bg-muted/20 p-3 hover:border-primary transition-colors"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </Link>
  );
}

function Arrow() {
  return (
    <div className="flex items-center text-muted-foreground/40">
      <ArrowRight className="size-4" />
    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "red" | "yellow" | "green" | "primary";
}) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 bg-card ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function WarKPI({
  label,
  value,
  icon,
  tone,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "red" | "yellow" | "green" | "primary" | "neutral";
  to: string;
}) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
    neutral: "border-border text-muted-foreground",
  };
  return (
    <Link
      to={to}
      className={`rounded-lg border bg-muted/10 p-2.5 hover:bg-muted/30 transition-colors ${tones[tone]}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-0.5 text-foreground">{value}</div>
    </Link>
  );
}

function Shortcut({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary hover:bg-muted/30 transition-colors flex items-center justify-between"
    >
      <span>{label}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
    </Link>
  );
}

function CoordinatorBriefing({ c }: { c: CollectionAggregate }) {
  const alerts: string[] = [];
  if (c.semPiloto > 0)
    alerts.push(`${c.semPiloto} produto${c.semPiloto > 1 ? "s" : ""} sem piloto aprovado`);
  if (c.semFicha > 0) alerts.push(`${c.semFicha} sem ficha técnica`);
  if (c.protoPendentes > 5) alerts.push(`${c.protoPendentes} protótipos pendentes`);
  if (c.opsAguardando > 0) alerts.push(`${c.opsAguardando} OPs aguardando liberação`);

  const verdict =
    alerts.length === 0 && c.avanco >= 80
      ? {
          tone: "success",
          label: "Coleção saudável",
          msg: `Avanço de ${Math.round(c.avanco)}% e sem bloqueios — siga com o ritmo atual.`,
        }
      : alerts.length >= 3 || c.semPiloto > 3
        ? {
            tone: "destructive",
            label: "Coleção em risco",
            msg: `Atenção: ${alerts.slice(0, 3).join(", ")}. Priorize destravar pilotos e fichas antes de abrir novas OPs.`,
          }
        : alerts.length > 0
          ? {
              tone: "warning",
              label: "Pontos de atenção",
              msg: `${alerts.slice(0, 3).join(" · ")}. Ajustar nesta semana mantém o cronograma.`,
            }
          : {
              tone: "primary",
              label: "Coleção em ritmo",
              msg: `Pipeline rodando com avanço de ${Math.round(c.avanco)}%. Acompanhar gargalos da produção.`,
            };

  const tones: Record<string, string> = {
    success: "border-success/40 bg-success/5",
    destructive: "border-destructive/40 bg-destructive/5",
    warning: "border-warning/40 bg-warning/5",
    primary: "border-primary/40 bg-primary/5",
  };
  const labelTones: Record<string, string> = {
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-primary",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[verdict.tone]}`}>
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-lg bg-[image:var(--gradient-primary)] grid place-items-center flex-shrink-0 shadow-[var(--shadow-glow)]">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Coordenador de Desenvolvimento · IA
          </div>
          <div className={`text-sm font-semibold ${labelTones[verdict.tone]} mt-0.5`}>
            {verdict.label}
          </div>
          <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{verdict.msg}</p>
          {c.champions[0] && (
            <p className="text-xs text-muted-foreground mt-2">
              Campeão da coleção:{" "}
              <span className="text-foreground font-medium">{c.champions[0].p.name}</span> (
              {c.champions[0].p.sku}) — R$ {(c.champions[0].rev / 1000).toFixed(1)}k em vendas.
              Considere reforçar produção.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function DigitalTwinAggregate({ c }: { c: CollectionAggregate }) {
  const coverage = c.coverageDays as number | null;
  const coverageLabel = coverage === null ? "—" : coverage > 365 ? "365+d" : `${coverage}d`;
  const coverageTone =
    coverage === null ? "neutral" : coverage < 14 ? "red" : coverage < 45 ? "yellow" : "green";
  const twinAlerts: string[] = [];
  if (c.ruptureSkus.length > 0)
    twinAlerts.push(`${c.ruptureSkus.length} SKU(s) vendendo sem estoque`);
  if (c.excessSkus.length > 0)
    twinAlerts.push(`${c.excessSkus.length} SKU(s) com cobertura acima de 120d`);
  if (coverage !== null && coverage < 14)
    twinAlerts.push(`cobertura agregada crítica (${coverage}d)`);
  if (c.sellThrough < 30 && c.stockUnits > 0)
    twinAlerts.push("sell-through baixo com estoque disponível");

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Gauge className="size-3.5 text-primary" /> Digital Twin agregado · vendas + estoque +
          produção
        </div>
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Database className="size-3" /> fonte {c.dataSource}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Estoque SKUs" value={`${Math.round(c.stockUnits)}`} tone="primary" />
        <Metric label="Valor parado" value={fmt(c.stockValue)} tone="neutral" />
        <Metric label="Cobertura" value={coverageLabel} tone={coverageTone} />
        <Metric label="Velocidade/dia" value={c.dailyVelocity.toFixed(1)} tone="neutral" />
        <Metric
          label="Risco twin"
          value={twinAlerts.length ? `${twinAlerts.length}` : "0"}
          tone={twinAlerts.length ? "yellow" : "green"}
        />
      </div>

      {twinAlerts.length > 0 && (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="text-xs font-medium text-warning flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Sinais do twin
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {twinAlerts.map((alert) => (
              <span
                key={alert}
                className="rounded bg-warning/10 px-2 py-0.5 text-[11px] text-warning"
              >
                {alert}
              </span>
            ))}
          </div>
        </div>
      )}

      {(c.ruptureSkus.length > 0 || c.excessSkus.length > 0) && (
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <TwinSkuList
            title="Ruptura com venda"
            icon={<Package className="size-3.5" />}
            rows={c.ruptureSkus.map((p: { id: string; sku: string; name: string }) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              meta: "sem estoque",
            }))}
            tone="red"
          />
          <TwinSkuList
            title="Possível excesso"
            icon={<Boxes className="size-3.5" />}
            rows={c.excessSkus.map((row: { p: { id: string; sku: string; name: string }; stock: number; days: number }) => ({
              id: row.p.id,
              sku: row.p.sku,
              name: row.p.name,
              meta: `${Math.round(row.stock)} un · ${row.days > 365 ? "365+d" : `${row.days}d`}`,
            }))}
            tone="yellow"
          />
        </div>
      )}
    </div>
  );
}

function TwinSkuList({
  title,
  icon,
  rows,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<{ id: string; sku: string; name: string; meta: string }>;
  tone: "red" | "yellow";
}) {
  const toneClass =
    tone === "red" ? "text-destructive border-destructive/30" : "text-warning border-warning/30";
  return (
    <div className={`rounded-lg border bg-muted/10 p-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
        {icon}
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sem SKUs nesta condição.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 text-sm text-foreground"
            >
              <span className="truncate">
                <span className="text-xs text-muted-foreground">{row.sku}</span> · {row.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{row.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InvestmentResult({ c }: { c: CollectionAggregate }) {
  const investment: number = c.investment;
  const productionCost: number = c.productionCost ?? 0;
  const marketingCost: number = c.marketingCost ?? 0;
  const revenue: number = c.revenue;
  const profit: number = c.profit;
  const roi: number = c.roi;
  const recovered = investment > 0 ? Math.min(100, (revenue / investment) * 100) : 0;
  const positive = profit >= 0;
  const prodPct = investment > 0 ? (productionCost / investment) * 100 : 0;
  const mktPct = investment > 0 ? (marketingCost / investment) * 100 : 0;

  const verdict =
    investment === 0
      ? "Sem custos registrados — preencha custo dos produtos e campanhas de marketing para calcular ROI."
      : revenue === 0
        ? `Investido ${fmt(investment)} (${fmt(productionCost)} produção + ${fmt(marketingCost)} marketing), ainda sem receita. Acompanhe sell-through.`
        : positive
          ? `Cada R$ 1 investido (produção + marketing) retornou R$ ${(revenue / investment).toFixed(2)}. Lucro consolidado ${fmt(profit)} · ROI ${roi.toFixed(0)}%.`
          : `Coleção ainda no vermelho: faltam ${fmt(-profit)} para cobrir produção (${fmt(productionCost)}) + marketing (${fmt(marketingCost)}). Recuperado ${recovered.toFixed(0)}%.`;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Wallet className="size-3.5 text-primary" /> ROI consolidado · produção + marketing ×
          receita
        </div>
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Database className="size-3" /> receita espelho ERP
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Produção" value={fmt(productionCost)} tone="neutral" />
        <Metric label="Marketing" value={fmt(marketingCost)} tone="neutral" />
        <Metric label="Receita realizada" value={fmt(revenue)} tone="primary" />
        <Metric
          label={positive ? "Lucro" : "A recuperar"}
          value={fmt(Math.abs(profit))}
          tone={positive ? "green" : "red"}
        />
        <Metric
          label="ROI"
          value={investment > 0 ? `${roi.toFixed(0)}%` : "—"}
          tone={roi >= 30 ? "green" : roi >= 0 ? "yellow" : "red"}
        />
      </div>
      {investment > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Composição do investimento</span>
            <span className="tabular-nums">
              {prodPct.toFixed(0)}% prod · {mktPct.toFixed(0)}% mkt
            </span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
            <div className="h-full bg-primary" style={{ width: `${prodPct}%` }} />
            <div className="h-full bg-amber-500" style={{ width: `${mktPct}%` }} />
          </div>
        </div>
      )}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Recuperação do investimento</span>
          <span className="tabular-nums">{recovered.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${positive ? "bg-success" : "bg-warning"}`}
            style={{ width: `${recovered}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{verdict}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "yellow" | "green" | "primary" | "neutral";
}) {
  const tones: Record<string, string> = {
    red: "text-destructive",
    yellow: "text-warning",
    green: "text-success",
    primary: "text-primary",
    neutral: "text-foreground",
  };
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function MetaMood({ c }: { c: CollectionAggregate }) {
  const goal = c.investment > 0 ? c.investment * 1.5 : Math.max(c.revenue * 1.2, 50000);
  const pct = goal > 0 ? Math.min(100, (c.revenue / goal) * 100) : 0;
  const moodKey =
    c.avanco >= 80 && c.semPiloto === 0
      ? "confiante"
      : c.semPiloto > 3 || c.protoPendentes > 10
        ? "tenso"
        : c.opsAguardando > 0
          ? "expectativa"
          : "neutro";
  const mood: Record<string, { emoji: string; label: string; tone: string; msg: string }> = {
    confiante: {
      emoji: "😎",
      label: "Confiante",
      tone: "text-success",
      msg: "Time alinhado, produção fluindo.",
    },
    tenso: {
      emoji: "😰",
      label: "Tenso",
      tone: "text-destructive",
      msg: "Muitos bloqueios — concentrar esforço em desbloquear.",
    },
    expectativa: {
      emoji: "🤔",
      label: "Expectativa",
      tone: "text-warning",
      msg: "OPs aguardando decisão — destravar essa semana.",
    },
    neutro: {
      emoji: "🙂",
      label: "Neutro",
      tone: "text-primary",
      msg: "Ritmo normal, manter atenção.",
    },
  };
  const m = mood[moodKey];

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <Target className="size-3.5 text-primary" /> Meta de receita
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-semibold tabular-nums">{fmt(c.revenue)}</div>
          <div className="text-xs text-muted-foreground">meta {fmt(goal)}</div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${pct >= 100 ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-warning"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
          {pct.toFixed(0)}% da meta · faltam {fmt(Math.max(0, goal - c.revenue))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <Heart className="size-3.5 text-primary" /> Mood da coleção
        </div>
        <div className="flex items-center gap-3">
          <div className="text-4xl">{m.emoji}</div>
          <div className="min-w-0">
            <div className={`text-sm font-semibold ${m.tone}`}>{m.label}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{m.msg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
