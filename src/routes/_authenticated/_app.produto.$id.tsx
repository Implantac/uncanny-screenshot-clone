import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import {
  ArrowLeft,
  Package,
  FileText,
  Layers,
  ListChecks,
  Ruler,
  Scissors,
  Factory,
  ShieldCheck,
  Megaphone,
  BarChart3,
  Clock,
  Sparkles,
  ImageIcon,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MaterialsPanel,
  OperationsPanel,
  MeasurementsPanel,
  CostsPanel,
} from "@/components/tech-pack/panels";
import { ProductTimeline } from "@/components/product-timeline";
import { ProductTimelineCollab } from "@/components/product-timeline-collab";

import { ProductGallery } from "@/components/product-gallery";
import { SkuPerformancePanel } from "@/components/sku-performance-panel";
import { StageGatePanel } from "@/components/stage-gate-panel";
import { ProductCostCockpit } from "@/components/product-cost-cockpit";

export const Route = createFileRoute("/_authenticated/_app/produto/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Produto ${params.id.slice(0, 8)} · USE MODA PLM` },
      {
        name: "description",
        content:
          "Product Workspace unificado: engenharia, ficha técnica, BOM, protótipos, produção, qualidade, marketing e BI em uma única tela.",
      },
    ],
  }),
  component: ProductWorkspace,
});

type ProductRow = {
  id: string;
  owner_id: string;
  sku: string;
  name: string;
  category: string | null;
  status: string;
  image_url: string | null;
  cost_price: number | null;
  sell_price: number | null;
  colors: string[] | null;
  sizes: string[] | null;
  grade: string | null;
  collection_id: string | null;
  abc_class: string | null;
  created_at: string;
  updated_at: string;
};

function ProductWorkspace() {
  const { id } = useParams({ from: "/_authenticated/_app/produto/$id" });
  useRealtime("products", ["product-workspace", id]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product-workspace", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, owner_id, sku, name, category, status, image_url, cost_price, sell_price, colors, sizes, grade, collection_id, abc_class, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as ProductRow | null;
    },
  });

  const { data: sheet } = useQuery({
    enabled: !!product,
    queryKey: ["product-workspace-sheet", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tech_sheets")
        .select(
          "id, owner_id, code, version, status, materials_cost, labor_cost, cost_price, overhead_pct, updated_at",
        )
        .eq("product_id", id)
        .order("status", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: prototypes = [] } = useQuery({
    enabled: !!product,
    queryKey: ["product-workspace-protos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prototypes")
        .select("id, code, stage, created_at, updated_at")
        .eq("product_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: ops = [] } = useQuery({
    enabled: !!product,
    queryKey: ["product-workspace-ops", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select("id, code, stage, status, quantity, created_at, updated_at")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <EmptyState
          icon={Package}
          title="Produto não encontrado"
          description="Esta referência pode ter sido descontinuada ou removida do catálogo."
          action={
            <Link
              to="/produtos"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="size-3.5" /> Voltar para produtos
            </Link>
          }
        />
      </div>
    );
  }

  const openOps = ops.filter((o) => o.status !== "concluida" && o.status !== "cancelada").length;
  const openProtos = prototypes.filter(
    (p) => p.stage !== "aprovado" && p.stage !== "reprovado",
  ).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        eyebrow={
          <Link
            to="/produtos"
            className="inline-flex items-center gap-1 hover:text-foreground transition"
          >
            <ArrowLeft className="size-3" /> Produtos
          </Link>
        }
        title={product.name}
        description={`${product.sku} · ${product.category ?? "sem categoria"}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <StageGatePanel productId={product.id} />
            <Badge variant="outline" className="capitalize">
              {product.status}
            </Badge>
            {product.abc_class && (
              <Badge
                variant="outline"
                className={
                  product.abc_class === "A"
                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                    : product.abc_class === "B"
                      ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                      : "bg-muted"
                }
              >
                ABC {product.abc_class}
              </Badge>
            )}
            {product.collection_id && (
              <Link
                to="/colecao-360/$id"
                params={{ id: product.collection_id }}
                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted"
              >
                <ExternalLink className="size-3" /> Coleção
              </Link>
            )}
          </div>
        }
      />

      {/* Header card com identidade do produto */}
      <div className="rounded-xl border border-border bg-card p-4 flex gap-4">
        <div className="size-24 rounded-lg overflow-hidden bg-muted/40 shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full grid place-items-center text-muted-foreground">
              <ImageIcon className="size-6" />
            </div>
          )}
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Metric label="Custo" value={product.cost_price != null ? `R$ ${Number(product.cost_price).toFixed(2)}` : "—"} />
          <Metric label="Preço" value={product.sell_price != null ? `R$ ${Number(product.sell_price).toFixed(2)}` : "—"} />
          <Metric label="Margem" value={margin(product.cost_price, product.sell_price)} />
          <Metric label="Protótipos abertos" value={String(openProtos)} tone={openProtos > 0 ? "warning" : "default"} />
          <Metric label="OPs em andamento" value={String(openOps)} tone={openOps > 0 ? "primary" : "default"} />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1 bg-muted/40 p-1">
          <TabTrig value="overview" icon={<Sparkles className="size-3.5" />}>Overview</TabTrig>
          <TabTrig value="ficha" icon={<FileText className="size-3.5" />}>Ficha técnica</TabTrig>
          <TabTrig value="bom" icon={<Layers className="size-3.5" />}>BOM</TabTrig>
          <TabTrig value="bop" icon={<ListChecks className="size-3.5" />}>Processo</TabTrig>
          <TabTrig value="medidas" icon={<Ruler className="size-3.5" />}>Medidas</TabTrig>
          <TabTrig value="custos" icon={<ShieldCheck className="size-3.5" />}>Custos</TabTrig>
          <TabTrig value="prototipos" icon={<Scissors className="size-3.5" />}>Protótipos</TabTrig>
          <TabTrig value="pcp" icon={<Factory className="size-3.5" />}>PCP</TabTrig>
          <TabTrig value="marketing" icon={<Megaphone className="size-3.5" />}>Marketing</TabTrig>
          <TabTrig value="bi" icon={<BarChart3 className="size-3.5" />}>BI</TabTrig>
          <TabTrig value="timeline" icon={<Clock className="size-3.5" />}>Timeline</TabTrig>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold mb-2">Galeria e referências</div>
              <ProductGallery productId={product.id} canEdit={false} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <ProductTimeline productId={product.id} createdAt={product.created_at} />
              <ProductTimelineCollab productId={product.id} />
            </div>

          </div>
        </TabsContent>

        <TabsContent value="ficha">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">v{sheet.version}</Badge>
                <Badge
                  variant="outline"
                  className={
                    sheet.status === "aprovada"
                      ? "bg-success/15 text-success border-success/30"
                      : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  }
                >
                  {sheet.status}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{sheet.code}</span>
                <Link
                  to="/ficha-tecnica"
                  search={{ product: product.id }}
                  className="ml-auto text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted"
                >
                  <ExternalLink className="size-3" /> Editor completo
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Metric label="Materiais" value={`R$ ${Number(sheet.materials_cost ?? 0).toFixed(2)}`} />
                <Metric label="Mão de obra" value={`R$ ${Number(sheet.labor_cost ?? 0).toFixed(2)}`} />
                <Metric label="Custo final" value={`R$ ${Number(sheet.cost_price ?? 0).toFixed(2)}`} />
              </div>
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="bom">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <MaterialsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="bop">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <OperationsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="medidas">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <MeasurementsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="custos">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <CostsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="prototipos">
          <div className="rounded-xl border border-border bg-card p-4">
            {prototypes.length === 0 ? (
              <EmptyState
                icon={Scissors}
                title="Nenhum protótipo"
                description="Ainda não há solicitações de protótipo para este produto."
              />
            ) : (
              <div className="space-y-2">
                {prototypes.map((p) => (
                  <Link
                    key={p.id}
                    to="/prototipo/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between border border-border rounded-lg px-3 py-2 hover:bg-muted transition"
                  >
                    <div className="flex items-center gap-2">
                      <Scissors className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{p.code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {p.stage.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pcp">
          <div className="rounded-xl border border-border bg-card p-4">
            {ops.length === 0 ? (
              <EmptyState
                icon={Factory}
                title="Nenhuma OP"
                description="Este produto ainda não gerou ordens de produção."
              />
            ) : (
              <div className="space-y-2">
                {ops.map((o) => (
                  <Link
                    key={o.id}
                    to="/lote/$id"
                    params={{ id: o.id }}
                    className="flex items-center justify-between border border-border rounded-lg px-3 py-2 hover:bg-muted transition text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Factory className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{o.code}</span>
                      <span className="text-xs text-muted-foreground">
                        qtd {o.quantity ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {String(o.stage).replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {o.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="marketing">
          <div className="rounded-xl border border-border bg-card p-4">
            <EmptyState
              icon={Megaphone}
              title="Marketing do produto"
              description="Abra o módulo de Marketing/ROI para ver campanhas, envios e retorno por peça."
              action={
                <Link
                  to="/marketing"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="size-3.5" /> Abrir marketing
                </Link>
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="bi">
          <div className="rounded-xl border border-border bg-card p-4">
            <SkuPerformancePanel
              productId={product.id}
              variants={[]}
              colors={[]}
              sizes={[]}
            />
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <div className="rounded-xl border border-border bg-card p-4">
            <ProductTimeline productId={product.id} createdAt={product.created_at} />
            <ProductTimelineCollab productId={product.id} />

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabTrig({
  value,
  icon,
  children,
}: {
  value: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger value={value} className="text-xs gap-1.5 h-8 px-3">
      {icon}
      {children}
    </TabsTrigger>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function margin(cost: number | null, sell: number | null) {
  if (!cost || !sell || sell <= 0) return "—";
  const m = ((sell - cost) / sell) * 100;
  return `${m.toFixed(1)}%`;
}

function NoSheet({ productId }: { productId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6">
      <EmptyState
        icon={FileText}
        title="Sem ficha técnica"
        description="Esta referência ainda não tem ficha aprovada. Crie ou vincule uma no editor completo."
        action={
          <Link
            to="/ficha-tecnica"
            search={{ product: productId }}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="size-3.5" /> Abrir editor de ficha
          </Link>
        }
      />
    </div>
  );
}
