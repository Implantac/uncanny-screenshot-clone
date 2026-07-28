import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileText,
  ImageIcon,
  Layers,
  Palette,
  PenTool,
  Ruler,
  Scissors,
  Shirt,
  Sparkles,
} from "lucide-react";
import { DesignerAIAssistant } from "@/components/designer-ai-assistant";
import { ProductReadinessBadge } from "@/components/product-readiness-badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/designer-workspace")({
  head: () => ({
    meta: [
      { title: "Workspace do Designer · USE MODA PLM" },
      {
        name: "description",
        content: "Protótipos abertos, aprovações pendentes, referências e mood.",
      },
    ],
  }),
  component: DesignerWorkspace,
});

type Prototype = {
  id: string;
  code: string | null;
  stage: string | null;
  created_at: string;
  product_id: string | null;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  image_url: string | null;
  status: string | null;
  colors: string[] | null;
  collection_id: string | null;
};

type Collection = {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  status: string | null;
  progress: number | null;
};

type TechSheet = {
  id: string;
  product_id: string | null;
  status: string | null;
};

const CREATIVE_STEPS = [
  {
    title: "Pesquisa e mood",
    description: "Referências, cores e direção visual.",
    to: "/trends",
    icon: Compass,
  },
  {
    title: "Produto",
    description: "Briefing, categoria, imagem e variantes.",
    to: "/produtos",
    icon: Shirt,
  },
  {
    title: "Ficha técnica",
    description: "Materiais, medidas, operações e custos.",
    to: "/ficha-tecnica",
    icon: FileText,
  },
  {
    title: "Prova e aprovação",
    description: "Protótipo, ajustes e liberação.",
    to: "/prototipos",
    icon: Scissors,
  },
] as const;

function stageLabel(stage: string | null) {
  if (!stage) return "Sem etapa";
  return stage.replaceAll("_", " ");
}

function productNeeds(product: Product, approvedSheetIds: Set<string>) {
  const needs = [];
  if (!product.image_url) needs.push("imagem");
  if (!product.category) needs.push("categoria");
  if (!product.colors?.length) needs.push("cores");
  if (!approvedSheetIds.has(product.id)) needs.push("ficha aprovada");
  return needs;
}

function DesignerWorkspace() {
  const { data, isLoading } = useQuery({
    queryKey: ["designer-workspace"],
    queryFn: async () => {
      const [protos, products, cols, techSheets] = await Promise.all([
        supabase
          .from("prototypes")
          .select("id, code, stage, created_at, product_id")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("products")
          .select("id, sku, name, category, image_url, status, colors, collection_id")
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("collections")
          .select("id, name, season, year, status, progress")
          .order("year", { ascending: false })
          .limit(12),
        supabase
          .from("tech_sheets")
          .select("id, product_id, status")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      return {
        prototypes: (protos.data ?? []) as Prototype[],
        products: (products.data ?? []) as Product[],
        collections: (cols.data ?? []) as Collection[],
        techSheets: (techSheets.data ?? []) as TechSheet[],
      };
    },
  });

  const approvedSheetProductIds = useMemo(
    () =>
      new Set(
        (data?.techSheets ?? [])
          .filter((sheet) => sheet.product_id && sheet.status === "aprovada")
          .map((sheet) => sheet.product_id as string),
      ),
    [data?.techSheets],
  );

  const openProtos = (data?.prototypes ?? []).filter(
    (p) => p.stage !== "aprovado" && p.stage !== "reprovado",
  );
  const pendingApproval = (data?.prototypes ?? []).filter(
    (p) => p.stage === "em_prova" || p.stage === "solicitado",
  );
  const draftProducts = (data?.products ?? []).filter(
    (p) => p.status === "rascunho" || p.status === "desenvolvimento",
  );
  const activeCollections = (data?.collections ?? []).filter((c) => c.status !== "entregue");
  const focusCollection =
    [...activeCollections].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0] ??
    activeCollections[0] ??
    null;

  const blockedProducts = draftProducts
    .map((product) => ({ product, needs: productNeeds(product, approvedSheetProductIds) }))
    .filter((item) => item.needs.length > 0);

  const collectionProducts = focusCollection
    ? draftProducts.filter((product) => product.collection_id === focusCollection.id)
    : draftProducts;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div className="rounded-lg border bg-card p-5 sm:p-6 overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Palette className="size-4 text-pink-600" />
                Atelier digital
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Workspace do Designer
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Coleções em andamento, peças em criação, provas pendentes e fichas que precisam
                  fechar antes da produção.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <Link
                to="/produtos"
                search={{
                  prefillName: undefined,
                  prefillCategory: undefined,
                  prefillColors: undefined,
                  q: "",
                }}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="size-4" />
                Nova peça
              </Link>
              <Link
                to="/trends"
                className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Compass className="size-4" />
                Moodboard
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Coleções ativas" value={activeCollections.length} icon={Layers} />
            <MetricCard label="Peças em criação" value={draftProducts.length} icon={Shirt} />
            <MetricCard
              label="Provas pendentes"
              value={pendingApproval.length}
              icon={Ruler}
              tone="warning"
            />
            <MetricCard
              label="Bloqueios criativos"
              value={blockedProducts.length}
              icon={AlertCircle}
              tone="danger"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" />
              Coleção em foco
            </CardTitle>
            <CardDescription>Maior avanço entre as coleções ativas.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : focusCollection ? (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold">{focusCollection.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[focusCollection.season, focusCollection.year].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(focusCollection.progress ?? 0, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{focusCollection.status ?? "Sem status"}</span>
                  <span>{focusCollection.progress ?? 0}%</span>
                </div>
                <Link
                  to="/colecao-360/$id"
                  params={{ id: focusCollection.id }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Abrir coleção
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma coleção ativa.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shirt className="size-4" />
              Peças em criação
            </CardTitle>
            <CardDescription>Rascunhos e produtos em desenvolvimento.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingRows />
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {collectionProducts.slice(0, 12).map((product) => (
                  <Link
                    key={product.id}
                    to="/produto/$id"
                    params={{ id: product.id }}
                    className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted"
                  >
                    <ProductImageMarker hasImage={Boolean(product.image_url)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{product.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {product.sku} · {product.category ?? "sem categoria"}
                      </div>
                    </div>
                    <ProductReadinessBadge productId={product.id} />
                  </Link>
                ))}
                {collectionProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma peça em criação.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-4" />O que bloqueia a liberação
            </CardTitle>
            <CardDescription>Itens que ainda impedem uma peça de seguir limpa.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingRows />
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {blockedProducts.slice(0, 12).map(({ product, needs }) => (
                  <Link
                    key={product.id}
                    to="/produto/$id"
                    params={{ id: product.id }}
                    className="block rounded-lg border px-3 py-2.5 hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{product.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{product.sku}</div>
                      </div>
                      <Badge variant="outline">{needs.length}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {needs.map((need) => (
                        <Badge key={need} variant="secondary" className="text-[11px]">
                          {need}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))}
                {blockedProducts.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-success" />
                    Peças em criação sem bloqueios principais.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="size-4" />
              Provas e protótipos
            </CardTitle>
            <CardDescription>Modelagem, piloto e feedback em aberto.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingRows />
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {openProtos.slice(0, 10).map((proto) => (
                  <Link
                    key={proto.id}
                    to={proto.product_id ? "/produto/$id" : "/prototipos"}
                    params={proto.product_id ? { id: proto.product_id } : undefined}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted"
                  >
                    <div>
                      <div className="font-mono text-xs">{proto.code ?? "Protótipo"}</div>
                      <div className="text-xs text-muted-foreground">{stageLabel(proto.stage)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {proto.product_id && <ProductReadinessBadge productId={proto.product_id} />}
                      <Badge variant="outline">{stageLabel(proto.stage)}</Badge>
                    </div>
                  </Link>
                ))}
                {openProtos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum protótipo aberto.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              Jornada da peça
            </CardTitle>
            <CardDescription>Do mood ao protótipo aprovado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {CREATIVE_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Link
                    key={step.title}
                    to={step.to}
                    className="flex items-center gap-3 rounded-lg border px-3 py-3 hover:bg-muted"
                  >
                    <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {index + 1}. {step.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {step.description}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <DesignerAIAssistant />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: typeof Layers;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4 text-muted-foreground",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-destructive",
          )}
        />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ProductImageMarker({ hasImage }: { hasImage: boolean }) {
  if (hasImage) {
    return (
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <ImageIcon className="size-4" />
      </div>
    );
  }

  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
      <PenTool className="size-4" />
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
