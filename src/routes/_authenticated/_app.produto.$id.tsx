import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { logProductView } from "@/lib/product-audit.functions";
import { pushRecentProduct } from "@/lib/recent-products";
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
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Lock,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui/page-header";
import { ProductPinButton } from "@/components/product-pin-button";
import { PlmBreadcrumb } from "@/components/ui/plm-breadcrumb";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MaterialsPanel,
  OperationsPanel,
  MeasurementsPanel,
  CostsPanel,
} from "@/components/tech-pack/panels";
import { ProductTimeline } from "@/components/product-timeline";
import { ProductTimelineCollab } from "@/components/product-timeline-collab-lazy";
import { TimelineFeed } from "@/components/timeline-feed";
import { PrototypeApprovalGate } from "@/components/prototype-approval-gate";

import { ProductGallery } from "@/components/product-gallery";
import { SkuPerformancePanel } from "@/components/sku-performance-panel";
import { StageGatePanel } from "@/components/stage-gate-panel";
import { ProductPilotControl } from "@/components/product-pilot-control";
import { ProductStatusControl } from "@/components/product-status-control";

import { ProductPcpHealthPanel } from "@/components/product-pcp-health";
import { ProductDigitalTwinPanel } from "@/components/product-digital-twin-panel";
import { ProductCostCockpit } from "@/components/product-cost-cockpit";
import { ProductCostEnginePanel } from "@/components/product-cost-engine-panel";
import { ProductWorkflowPanel } from "@/components/product-workflow-panel";
import { ProductLifecycleCopilotPanel } from "@/components/product-lifecycle-copilot-panel";
import { ProductWorkflowStepper } from "@/components/product-workflow-stepper";
import { ProductReadinessCard } from "@/components/product-readiness-card";
import { ProductNextStepBanner } from "@/components/product-next-step-banner";
import { ProductPrintArtworksPanel } from "@/components/product-print-artworks-panel";
import { ProductLifecycleGuide } from "@/components/product-lifecycle-guide";
import { ProductSizeGridCard } from "@/components/product-size-grid-card";
import { ProductPriceSuggestionCard } from "@/components/product-price-suggestion-card";
import { DesignerNotes } from "@/components/designer-notes";
import {
  FichaDocument,
  type DocMaterial,
  type CompletenessItem,
} from "@/components/tech-pack/sheet-document";
import {
  listTechSheetBlocks,
  saveTechSheetBlock,
  type TechSheetBlockKey,
  type SheetBlockRow,
} from "@/lib/tech-sheet-blocks.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import {
  canEditDraft,
  canEditMaterials,
  canEditMeasurements,
  canEditCosts,
} from "@/lib/permissions";

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

type SheetContent = {
  overview: string;
  materials: string[];
  operations: string[];
  measurements: string[];
  consumption: string[];
  costs: string[];
  documents: string[];
  composition: Record<string, string>[];
  packaging: Record<string, string>[];
  treatments: Record<string, string>[];
  printing: Record<string, string>[];
  embroidery: Record<string, string>[];
  laundry: Record<string, string>[];
  quality: Record<string, string>[];
};

const EMPTY_CONTENT: SheetContent = {
  overview: "",
  materials: [],
  operations: [],
  measurements: [],
  consumption: [],
  costs: [],
  documents: [],
  composition: [],
  packaging: [],
  treatments: [],
  printing: [],
  embroidery: [],
  laundry: [],
  quality: [],
};

const BLOCK_KEYS = [
  "composition",
  "packaging",
  "treatments",
  "printing",
  "embroidery",
  "laundry",
  "quality",
] as const;

function parseBlocks(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Record<string, string> => x !== null && typeof x === "object");
}

function parseSheetContent(content: string | null): SheetContent {
  if (!content) return EMPTY_CONTENT;
  try {
    const parsed = JSON.parse(content) as Partial<SheetContent>;
    const base: SheetContent = {
      overview: parsed.overview ?? "",
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      measurements: Array.isArray(parsed.measurements) ? parsed.measurements : [],
      consumption: Array.isArray(parsed.consumption) ? parsed.consumption : [],
      costs: Array.isArray(parsed.costs) ? parsed.costs : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      composition: [],
      packaging: [],
      treatments: [],
      printing: [],
      embroidery: [],
      laundry: [],
      quality: [],
    };
    for (const key of BLOCK_KEYS) {
      base[key] = parseBlocks(parsed[key]);
    }
    return base;
  } catch {
    return { ...EMPTY_CONTENT, overview: content };
  }
}

function stringifySheetContent(content: SheetContent) {
  return JSON.stringify(content);
}

function ProductWorkspace() {
  const { id } = useParams({ from: "/_authenticated/_app/produto/$id" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roles } = useUserRole();
  useRealtime("products", ["product-workspace", id]);
  const audit = useServerFn(logProductView);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    audit({ data: { productId: id } }).catch(() => {});
  }, [id, audit]);

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

  useEffect(() => {
    if (product?.id) pushRecentProduct({ id: product.id, sku: product.sku, name: product.name });
  }, [product?.id, product?.sku, product?.name]);

  // Wave 35 — shortcut "P" toggles pin on current product workspace
  useEffect(() => {
    if (!product?.id) return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      const { togglePinnedProduct } = await import("@/lib/recent-products");
      const { toast } = await import("sonner");
      const now = togglePinnedProduct({ id: product.id, sku: product.sku, name: product.name });
      toast.success(now ? "Produto fixado (P)" : "Produto desafixado (P)");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product?.id, product?.sku, product?.name]);

  // Wave 39 — shortcuts "[" / "]" navegam entre produtos recentes
  useEffect(() => {
    if (!product?.id) return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "[" && e.key !== "]") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const { getRecentProducts } = await import("@/lib/recent-products");
      const list = getRecentProducts();
      if (list.length < 2) return;
      const idx = list.findIndex((x) => x.id === product.id);
      if (idx < 0) return;
      const nextIdx =
        e.key === "]" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
      const target = list[nextIdx];
      if (!target || target.id === product.id) return;
      e.preventDefault();
      const { toast } = await import("sonner");
      toast.info(`${e.key === "]" ? "Próximo" : "Anterior"}: ${target.sku}`);
      navigate({ to: "/produto/$id", params: { id: target.id } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product?.id, navigate]);

  const { data: sheet } = useQuery({
    enabled: !!product,
    queryKey: ["product-workspace-sheet", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tech_sheets")
        .select(
          "id, owner_id, code, version, status, materials_cost, labor_cost, cost_price, overhead_pct, updated_at, content",
        )
        .eq("product_id", id)
        .order("status", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: docMaterials = [] } = useQuery({
    enabled: !!sheet?.id,
    queryKey: ["product-workspace-sheet-materials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_materials")
        .select(
          "id, name, type, code, description, supplier, color, unit, consumption, loss_pct, unit_cost, total_cost",
        )
        .eq("tech_sheet_id", sheet!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as DocMaterial[];
    },
  });

  const sheetContent = useMemo<SheetContent>(
    () => parseSheetContent(sheet?.content ?? null),
    [sheet?.content],
  );

  const sheetUnlocked = !!sheet && sheet.status !== "aprovada";
  const isProductOwner = !!user && !!sheet && sheet.owner_id === user.id;
  // RBAC granular: além de usuário ser dono e ficha não aprovada, cada módulo
  // respeita a role. Quem não é dono mantém leitura (vendedor/comprador fora do módulo).
  const canEditDraftBlock = isProductOwner && sheetUnlocked && canEditDraft(roles);
  const canEditMaterialsBlock = isProductOwner && sheetUnlocked && canEditMaterials(roles);
  const canEditMeasurementsBlock = isProductOwner && sheetUnlocked && canEditMeasurements(roles);
  const canEditCostsBlock = isProductOwner && sheetUnlocked && canEditCosts(roles);
  // No Product Workspace, permitir edição inline quando o usuário tem alguma
  // permissão de edição (draft abrange blocos/observações).
  const canEditSheet = canEditDraftBlock;

  // Grade real do produto (color × size via product_variants).
  const { data: variants = [] } = useQuery({
    enabled: !!product?.id,
    queryKey: ["product-workspace-variants", product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, sku, active, color:color_id(name), size:size_id(label)")
        .eq("product_id", product!.id);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        sku: string;
        active: boolean;
        color: { name: string } | null;
        size: { label: string } | null;
      }>;
    },
  });
  const realSizes = Array.from(
    new Set(variants.map((v) => v.size?.label).filter(Boolean) as string[]),
  );
  const realColors = Array.from(
    new Set(variants.map((v) => v.color?.name).filter(Boolean) as string[]),
  );

  const queryClient = useQueryClient();

  // Toggle ativo/inativo de variante (matriz SKU no documento).
  const toggleVariantActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("product_variants").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-workspace-variants", product?.id] });
      toast.success("Variante atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSheetContent = useMutation({
    mutationFn: async (content: SheetContent) => {
      if (!sheet?.id) throw new Error("Selecione uma ficha");
      const { error } = await supabase
        .from("tech_sheets")
        .update({ content: stringifySheetContent(content) })
        .eq("id", sheet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-workspace-sheet", id] });
      toast.success("Ficha atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeness = useMemo<CompletenessItem[]>(() => {
    if (!sheet) return [];
    const hasCost = Number(sheet.cost_price ?? 0) > 0 || sheetContent.costs.length > 0;
    const gradeDefined = realSizes.length > 0 || Number(product?.sizes?.length ?? 0) > 0;
    const colorsDefined = realColors.length > 0 || Number(product?.colors?.length ?? 0) > 0;
    return [
      { key: "dados", label: "Dados gerais preenchidos", ok: Boolean(sheet.code && product) },
      { key: "imagem", label: "Imagem principal enviada", ok: Boolean(product?.image_url) },
      { key: "materiais", label: "Materiais definidos", ok: docMaterials.length > 0 },
      { key: "grade", label: "Grade definida", ok: gradeDefined },
      { key: "cores", label: "Cores definidas", ok: colorsDefined },
      { key: "skus", label: "Variantes/SKUs geradas", ok: variants.length > 0 },
      { key: "medidas", label: "Medidas preenchidas", ok: sheetContent.measurements.length > 0 },
      { key: "custo", label: "Custo calculado", ok: hasCost },
      { key: "amostra", label: "Amostra aprovada", ok: false },
      { key: "aprovacao", label: "Aprovação final realizada", ok: sheet.status === "aprovada" },
    ];
  }, [sheet, sheetContent, product, docMaterials, realSizes, realColors, variants]);

  function updateBlock(block: TechSheetBlockKey, items: SheetBlockRow[]) {
    if (!sheet?.id) return;
    // Persistência transacional (tabela) + trigger mantém o JSON sincronizado.
    saveBlock.mutate({ techSheetId: sheet.id, block, items });
  }

  const listBlocksFn = useServerFn(listTechSheetBlocks);
  const saveBlocksFn = useServerFn(saveTechSheetBlock);

  const saveBlock = useMutation({
    mutationFn: (args: { techSheetId: string; block: TechSheetBlockKey; items: SheetBlockRow[] }) =>
      saveBlocksFn({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-workspace-sheet-blocks", id] });
      queryClient.invalidateQueries({ queryKey: ["product-workspace-sheet", id] });
      toast.success("Bloco atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: blocksData } = useQuery({
    enabled: !!sheet?.id,
    queryKey: ["product-workspace-sheet-blocks", id],
    queryFn: () => listBlocksFn({ data: { techSheetId: sheet!.id } }),
  });

  // Blocos exibidos no documento: prioriza tabelas, fallback JSON.
  const displayBlocks = useMemo(() => {
    const base = blocksData ?? ({} as Record<TechSheetBlockKey, SheetBlockRow[]>);
    return {
      composition: base.composition ?? sheetContent.composition,
      packaging: base.packaging ?? sheetContent.packaging,
      treatments: base.treatments ?? sheetContent.treatments,
      printing: base.printing ?? sheetContent.printing,
      embroidery: base.embroidery ?? sheetContent.embroidery,
      laundry: base.laundry ?? sheetContent.laundry,
      quality: base.quality ?? sheetContent.quality,
    };
  }, [blocksData, sheetContent]);

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
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <PlmBreadcrumb
          items={[{ label: "Produtos", link: { to: "/produtos" } }, { label: "Carregando…" }]}
        />
        <div className="h-10 w-2/3 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <div className="h-64 bg-muted rounded-xl animate-pulse" />
          <div className="space-y-3">
            <div className="h-24 bg-muted rounded-xl animate-pulse" />
            <div className="h-32 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <PlmBreadcrumb
          items={[{ label: "Produtos", link: { to: "/produtos" } }, { label: "Não encontrado" }]}
        />
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

  const crumbs = [
    { label: "Produtos", link: { to: "/produtos" as const } },
    ...(product.collection_id
      ? [
          {
            label: "Coleção",
            link: { to: "/colecao-360/$id" as const, params: { id: product.collection_id } },
          },
        ]
      : []),
    { label: product.sku },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PlmBreadcrumb items={crumbs} />
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category ?? "sem categoria"}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <ProductPinButton id={product.id} sku={product.sku} name={product.name} />
            <StageGatePanel productId={product.id} />
            <StatusBadge kind="product" value={product.status} />
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
            <img src={product.image_url} alt={product.name} className="size-full object-cover" />
          ) : (
            <div className="size-full grid place-items-center text-muted-foreground">
              <ImageIcon className="size-6" />
            </div>
          )}
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Metric
            label="Custo"
            value={product.cost_price != null ? `R$ ${Number(product.cost_price).toFixed(2)}` : "—"}
          />
          <Metric
            label="Preço"
            value={product.sell_price != null ? `R$ ${Number(product.sell_price).toFixed(2)}` : "—"}
          />
          <Metric
            label="Margem"
            value={margin(product.cost_price, product.sell_price)}
            tone={sellPriceToMarginTone(product.cost_price, product.sell_price)}
          />
          <Metric
            label="Protótipos abertos"
            value={String(openProtos)}
            tone={openProtos > 0 ? "warning" : "default"}
          />
          <Metric
            label="OPs em andamento"
            value={String(openOps)}
            tone={openOps > 0 ? "primary" : "default"}
          />
        </div>
      </div>

      {/* Notas do Designer — post-it persistente */}
      <DesignerNotes productId={product.id} />

      <ProductLifecycleGuide productId={product.id} />

      {/* Grade de Tamanhos + Preço Sugerido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ProductSizeGridCard productId={product.id} category={product.category} />
        <ProductPriceSuggestionCard productId={product.id} />
      </div>

      <ProductNextStepBanner productId={product.id} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex items-center gap-2">
          <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/40 p-1 flex-1">
            {/* Principais — sempre visíveis */}
            <TabTrig value="overview" icon={<Sparkles className="size-3.5" />}>
              Overview
            </TabTrig>
            <TabTrig value="ficha" icon={<FileText className="size-3.5" />}>
              Ficha técnica
            </TabTrig>
            <TabTrig value="prototipos" icon={<Scissors className="size-3.5" />}>
              Protótipos
            </TabTrig>
            <TabTrig value="timeline" icon={<Clock className="size-3.5" />}>
              Timeline
            </TabTrig>

            {/* Separador visual + Avançadas em dropdown */}
            <div className="w-px h-6 bg-border/60 mx-1" aria-hidden />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <ChevronDown className="size-3" />
                  Avançadas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onSelect={() => setTab("bom")}>
                  <Layers className="size-3.5 mr-2" /> BOM
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("bop")}>
                  <ListChecks className="size-3.5 mr-2" /> Processo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("medidas")}>
                  <Ruler className="size-3.5 mr-2" /> Medidas
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("custos")}>
                  <ShieldCheck className="size-3.5 mr-2" /> Custos
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("pcp")}>
                  <Factory className="size-3.5 mr-2" /> PCP
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("marketing")}>
                  <Megaphone className="size-3.5 mr-2" /> Marketing
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("bi")}>
                  <BarChart3 className="size-3.5 mr-2" /> BI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsList>
          <TooltipProvider>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span tabIndex={0} className={sheet && canEditSheet ? "" : "cursor-not-allowed"}>
                  <Button
                    size="sm"
                    variant={editMode ? "default" : "outline"}
                    className="gap-1.5 h-8 shrink-0 text-xs"
                    disabled={!sheet || !canEditSheet}
                    aria-disabled={!sheet || !canEditSheet}
                    onClick={() => setEditMode((v) => !v)}
                  >
                    {editMode ? (
                      <>
                        <Lock className="size-3.5" /> Bloquear edição
                      </>
                    ) : (
                      <>
                        <Edit3 className="size-3.5" /> Editar ficha
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {!sheet
                  ? "Crie uma ficha técnica primeiro"
                  : !canEditSheet
                    ? "Sua role não permite editar esta ficha (somente leitura)"
                    : editMode
                      ? "Bloquear edição desta ficha técnica"
                      : "Editar ficha técnica (BOM, BOP, Medidas)"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <ProductReadinessCard productId={product.id} />
          <ProductWorkflowPanel productId={product.id} />
          <ProductLifecycleCopilotPanel productId={product.id} />
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

        <TabsContent value="ficha" className="space-y-4">
          {sheet ? (
            <>
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
                    search={{ productId: product.id }}
                    className="ml-auto text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted"
                  >
                    <ExternalLink className="size-3" /> Editor completo
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Metric
                    label="Materiais"
                    value={`R$ ${Number(sheet.materials_cost ?? 0).toFixed(2)}`}
                  />
                  <Metric
                    label="Mão de obra"
                    value={`R$ ${Number(sheet.labor_cost ?? 0).toFixed(2)}`}
                  />
                  <Metric
                    label="Custo final"
                    value={`R$ ${Number(sheet.cost_price ?? 0).toFixed(2)}`}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <FichaDocument
                  status={sheet.status as "rascunho" | "em_revisao" | "aprovada"}
                  completeness={completeness}
                  productName={product.name}
                  productSku={product.sku}
                  code={sheet.code}
                  version={sheet.version}
                  materials={docMaterials}
                  blockFields={{
                    composition: displayBlocks.composition,
                    packaging: displayBlocks.packaging,
                    treatments: displayBlocks.treatments,
                    printing: displayBlocks.printing,
                    embroidery: displayBlocks.embroidery,
                    laundry: displayBlocks.laundry,
                    quality: displayBlocks.quality,
                  }}
                  observations={sheetContent.overview}
                  canEdit={editMode && canEditSheet}
                  skuVariants={variants}
                  onToggleVariantActive={(variantId, active) =>
                    toggleVariantActive.mutate({ id: variantId, active })
                  }
                  onObservationChange={(v) =>
                    saveSheetContent.mutate({ ...sheetContent, overview: v })
                  }
                  onBlockChange={(block, items) =>
                    updateBlock(block as TechSheetBlockKey, items as SheetBlockRow[])
                  }
                />
              </div>
            </>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="bom">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <MaterialsPanel
                sheetId={sheet.id}
                ownerId={sheet.owner_id}
                canEdit={editMode && canEditMaterialsBlock}
              />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="bop">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <OperationsPanel
                sheetId={sheet.id}
                ownerId={sheet.owner_id}
                canEdit={editMode && canEditDraftBlock}
              />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="medidas">
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <MeasurementsPanel
                sheetId={sheet.id}
                ownerId={sheet.owner_id}
                canEdit={editMode && canEditMeasurementsBlock}
              />
            </div>
          ) : (
            <NoSheet productId={product.id} />
          )}
        </TabsContent>

        <TabsContent value="custos" className="space-y-4">
          <ProductCostCockpit productId={product.id} />
          <ProductCostEnginePanel productId={product.id} />
          {sheet ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <CostsPanel
                sheetId={sheet.id}
                ownerId={sheet.owner_id}
                canEdit={editMode && canEditCostsBlock}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-4">
              <EmptyState
                icon={ShieldCheck}
                title="Custos disponíveis após criar ficha técnica"
                description="Crie uma ficha técnica com BOM (materiais) e BOP (operações) para ver o detalhamento de custos automaticamente."
                action={
                  <Link
                    to="/ficha-tecnica"
                    search={{ productId: product.id }}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="size-3.5" /> Criar ficha técnica
                  </Link>
                }
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="prototipos" className="space-y-3">
          <ProductPilotControl
            productId={product.id}
            productSku={product.sku}
            productStatus={product.status}
          />
          {prototypes.length === 0 ? null : (

            <div className="space-y-3">
              {/* Visual Approval Flow */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Scissors className="size-4 text-primary" /> Fluxo de Prototipagem
                </div>
                <div className="flex flex-wrap gap-2">
                  {prototypes.map((p) => {
                    const stage = p.stage as string;
                    const stages = ["em_producao", "fitting", "ajuste", "aprovado"];
                    const currentIdx = stages.indexOf(stage);
                    const isApproved = stage === "aprovado";
                    const isRejected = stage === "reprovado";
                    return (
                      <Link
                        key={p.id}
                        to="/prototipo/$id"
                        params={{ id: p.id }}
                        className={`
                          flex-1 min-w-[140px] rounded-xl border p-3 hover:shadow-md transition
                          ${
                            isApproved
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : isRejected
                                ? "border-rose-500/40 bg-rose-500/5"
                                : "border-border bg-card hover:border-primary/30"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-semibold">{p.code}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {stages.map((s, i) => {
                            const done = stages.indexOf(stage) >= i;
                            const isCurrent = stages.indexOf(stage) === i;
                            return (
                              <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full ${
                                  done
                                    ? i <= stages.indexOf(stage)
                                      ? stage === "aprovado"
                                        ? "bg-emerald-500"
                                        : "bg-primary"
                                      : "bg-muted"
                                    : "bg-muted/60"
                                } ${isCurrent && !isApproved ? "animate-pulse" : ""}`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`text-[9px] capitalize ${
                              isApproved
                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                : isRejected
                                  ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                                  : "bg-primary/10 text-primary border-primary/30"
                            }`}
                          >
                            {stage.replace(/_/g, " ")}
                          </Badge>
                          {isApproved && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                          {isRejected && <AlertTriangle className="size-3.5 text-rose-600" />}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* PrototypeApprovalGate — selos de aprovação para cada protótipo */}
              {prototypes.filter((p) => p.stage !== "reprovado").length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    Gates de aprovação por protótipo
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {prototypes
                      .filter((p) => p.stage !== "reprovado")
                      .map((p) => (
                        <PrototypeApprovalGate
                          key={p.id}
                          prototypeId={p.id}
                          currentStage={p.stage}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Total", v: prototypes.length },
                  {
                    l: "Abertos",
                    v: prototypes.filter((p) => p.stage !== "aprovado" && p.stage !== "reprovado")
                      .length,
                    tone: "text-amber-600",
                  },
                  {
                    l: "Aprovados",
                    v: prototypes.filter((p) => p.stage === "aprovado").length,
                    tone: "text-emerald-600",
                  },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-lg border border-border bg-card p-3 text-center"
                  >
                    <div className={`text-lg font-semibold tabular-nums ${s.tone ?? ""}`}>
                      {s.v}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pcp" className="space-y-4">
          <ProductPcpHealthPanel productId={product.id} />
          <ProductPrintArtworksPanel productId={product.id} />
          <ProductDigitalTwinPanel productId={product.id} />
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
                      <span className="text-xs text-muted-foreground">qtd {o.quantity ?? "—"}</span>
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
              description="Gerencie campanhas, envios para influenciadores e retorno sobre investimento (ROI) por peça."
              action={
                <div className="flex flex-wrap gap-2 justify-center">
                  <Link
                    to="/marketing"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="size-3.5" /> Abrir marketing
                  </Link>
                  <Link
                    to="/influencers"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="size-3.5" /> Influenciadores
                  </Link>
                </div>
              }
            />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-4">
              {[
                {
                  t: "📸 Envio para creators",
                  d: "Selecione influenciadores, registre envios e acompanhe conteúdo gerado.",
                },
                {
                  t: "📊 ROI por peça",
                  d: "Compare custo de produção vs retorno de vendas impulsionadas por campanha.",
                },
                {
                  t: "📅 Calendário de campanhas",
                  d: "Visualize lançamentos, drops e ações sazonais em linha do tempo.",
                },
              ].map((card) => (
                <div
                  key={card.t}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3 text-left"
                >
                  <div className="text-sm font-medium mb-1">{card.t}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{card.d}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bi">
          <div className="rounded-xl border border-border bg-card p-4">
            <SkuPerformancePanel productId={product.id} variants={[]} colors={[]} sizes={[]} />
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <ProductTimeline productId={product.id} createdAt={product.created_at} />
            <ProductTimelineCollab productId={product.id} />
          </div>
          <TimelineFeed
            entityIds={[product.id]}
            title="Timeline unificada (todos os setores)"
            emptyLabel="Nenhum evento vinculado a este produto ainda."
          />
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

function sellPriceToMarginTone(
  cost: number | null,
  sell: number | null,
): "default" | "primary" | "warning" {
  if (!cost || !sell || sell <= 0) return "default";
  const m = ((sell - cost) / sell) * 100;
  if (m >= 55) return "primary";
  if (m >= 40) return "warning";
  return "default";
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
            search={{ productId }}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="size-3.5" /> Abrir editor de ficha
          </Link>
        }
      />
    </div>
  );
}
