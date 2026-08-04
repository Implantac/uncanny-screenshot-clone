import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Copy,
  FileText,
  Layers3,
  Pencil,
  Plus,
  Ruler,
  Scissors,
  Trash2,
  Wallet,
  Sparkles,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestTechSheetImprovements } from "@/lib/tech-pack-ai.functions";
import { Markdown } from "@/components/markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFabNewAction } from "@/components/contextual-fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MaterialsPanel,
  OperationsPanel,
  MeasurementsPanel,
  CostsPanel,
} from "@/components/tech-pack/panels";
import { BomTemplatesButton } from "@/components/bom-templates-button";
import { TechSheetVersionsDrawer } from "@/components/tech-sheet-versions-drawer-lazy";
import { TechSheetCostAlertsPanel } from "@/components/tech-sheet-cost-alerts-panel";
import { TechSheetBomReviewPanel } from "@/components/tech-sheet-bom-review-panel";
import { TechPackImportButton } from "@/components/tech-pack-import-button";
import { TechPackExportButtonLazy as TechPackExportButton } from "@/components/tech-pack-export-button-lazy";
import { approveTechSheet } from "@/lib/tech-sheet-approve.functions";
import { ShieldCheck, Camera, Lock } from "lucide-react";
import { FichaDocument } from "@/components/tech-pack/sheet-document";
import type {
  CompletenessItem,
  DocMaterial,
} from "@/components/tech-pack/sheet-document";
import { ProductReadinessBadge } from "@/components/product-readiness-badge";
import { PageHeader } from "@/components/ui/page-header";
import { PlmBreadcrumb } from "@/components/ui/plm-breadcrumb";
import { StatusBadge } from "@/components/status-badge";
import { ProductWorkflowStepper } from "@/components/product-workflow-stepper";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/_app/ficha-tecnica")({
  validateSearch: zodValidator(
    z.object({ productId: fallback(z.string().regex(UUID_RE).optional(), undefined) }),
  ),
  head: () => ({
    meta: [
      { title: "Ficha Técnica · USE MODA OS" },
      {
        name: "description",
        content:
          "Fichas técnicas com visualização de produto, seções estruturadas e histórico de versões.",
      },
    ],
  }),
  component: FichaTecnicaPage,
});

type Status = "rascunho" | "em_revisao" | "aprovada";

type Sheet = {
  id: string;
  owner_id: string;
  product_id: string | null;
  code: string;
  version: string;
  status: Status;
  content: string | null;
  created_at: string;
};

type ProductRef = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  image_url: string | null;
  colors?: string[] | null;
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

const LABEL: Record<Status, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
};

const COLOR: Record<Status, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_revisao: "bg-warning/20 text-warning border-warning/30",
  aprovada: "bg-success/20 text-success border-success/30",
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
  return value.filter(
    (x): x is Record<string, string> => x !== null && typeof x === "object",
  );
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

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function resolveProductImage(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const { data, error } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

function FichaTecnicaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { productId: deepLinkProductId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sheet | null>(null);
  const [initialProductId, setInitialProductId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["tech_sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sheet[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["tech-sheet-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, category, image_url, colors")
        .order("name");
      if (error) throw error;
      return data as ProductRef[];
    },
  });

  useEffect(() => {
    if (!sheets.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && sheets.some((sheet) => sheet.id === current) ? current : sheets[0].id,
    );
  }, [sheets]);

  useEffect(() => {
    if (!deepLinkProductId) return;
    const match = sheets.find((s) => s.product_id === deepLinkProductId);
    if (match) {
      setSelectedId(match.id);
    } else {
      setEditing(null);
      setInitialProductId(deepLinkProductId);
      setOpen(true);
      toast.info("Nenhuma ficha para esse produto — criando uma nova.");
    }
    navigate({ search: { productId: undefined }, replace: true });
  }, [deepLinkProductId, sheets, navigate]);

  const selected = useMemo(
    () => sheets.find((item) => item.id === selectedId) ?? sheets[0] ?? null,
    [selectedId, sheets],
  );
  const selectedContent = useMemo(
    () => parseSheetContent(selected?.content ?? null),
    [selected?.content],
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selected?.product_id) ?? null,
    [products, selected?.product_id],
  );

  const { data: docMaterials = [] } = useQuery({
    enabled: !!selected?.id,
    queryKey: ["ts-doc-materials", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_materials")
        .select(
          "id, name, type, code, description, supplier, color, unit, consumption, loss_pct, unit_cost, total_cost",
        )
        .eq("tech_sheet_id", selected!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as DocMaterial[];
    },
  });

  const canEdit = selected?.owner_id === user?.id && selected?.status !== "aprovada";

  const completeness = useMemo<CompletenessItem[]>(() => {
    if (!selected) return [];
    const hasCost = selectedContent.costs.length > 0;
    return [
      { key: "dados", label: "Dados gerais preenchidos", ok: Boolean(selected.code && selectedProduct) },
      { key: "imagem", label: "Imagem principal enviada", ok: Boolean(selectedProduct?.image_url) },
      { key: "materiais", label: "Materiais definidos", ok: docMaterials.length > 0 },
      { key: "grade", label: "Grade definida", ok: selectedContent.measurements.length > 0 },
      { key: "cores", label: "Cores definidas", ok: Boolean(selectedProduct?.colors?.length) },
      { key: "medidas", label: "Medidas preenchidas", ok: selectedContent.measurements.length > 0 },
      { key: "custo", label: "Custo calculado", ok: hasCost },
      { key: "amostra", label: "Amostra aprovada", ok: false },
      { key: "aprovacao", label: "Aprovação final realizada", ok: selected.status === "aprovada" },
    ];
  }, [selected, selectedContent, selectedProduct, docMaterials]);

  const saveSheetContent = useMutation({
    mutationFn: async (content: SheetContent) => {
      if (!selected?.id) throw new Error("Selecione uma ficha");
      const { error } = await supabase
        .from("tech_sheets")
        .update({ content: stringifySheetContent(content) })
        .eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success("Ficha atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateBlock(
    block: keyof Omit<SheetContent, "overview" | "materials" | "operations" | "measurements" | "consumption" | "costs" | "documents">,
    items: Record<string, string>[],
  ) {
    const next = { ...selectedContent, [block]: items };
    saveSheetContent.mutate(next);
  }

  const versionHistory = useMemo(() => {
    if (!selected) return [];
    return sheets
      .filter((item) => item.code === selected.code)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [selected, sheets]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_sheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success("Ficha removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function bumpVersion(v: string) {
    const m = v.match(/^v?(\d+)\.(\d+)$/i);
    if (m) return `v${m[1]}.${Number(m[2]) + 1}`;
    return `${v}-r${Date.now().toString().slice(-3)}`;
  }

  const newVersion = useMutation({
    mutationFn: async (sheet: Sheet) => {
      if (!user?.id) throw new Error("Sessão expirada");
      const { data, error } = await supabase
        .from("tech_sheets")
        .insert({
          owner_id: user.id,
          product_id: sheet.product_id,
          code: sheet.code,
          version: bumpVersion(sheet.version),
          status: "rascunho",
          content: sheet.content,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["tech_sheets"] });
      setSelectedId(id);
      toast.success("Nova versão criada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  useFabNewAction(openCreate);

  function openEdit(sheet: Sheet) {
    setEditing(sheet);
    setOpen(true);
  }

  const fichaCrumbs = selected
    ? [
        { label: "Ficha Técnica", link: { to: "/ficha-tecnica" as const } },
        ...(selectedProduct
          ? [{ label: selectedProduct.sku, link: { to: "/produto/$id" as const, params: { id: selectedProduct.id } } }]
          : []),
        { label: `${selected.code} · ${selected.version}` },
      ]
    : [{ label: "Ficha Técnica" }];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PlmBreadcrumb items={fichaCrumbs} />
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Ficha Técnica Inteligente
          </span>
        }
        description="Visualização de produto, conteúdo estruturado por área e histórico versionado."
        actions={
          <>
            <TechPackImportButton />
            <Button onClick={openCreate} className="gap-2">
              <Plus className="size-4" /> Nova ficha
            </Button>
          </>
        }
      />
      {selected?.product_id && <ProductWorkflowStepper productId={selected.product_id} />}
      <div className="w-full grid gap-3 md:grid-cols-2">
        <TechSheetCostAlertsPanel />
        <TechSheetBomReviewPanel />
      </div>



      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4" aria-label="Carregando fichas técnicas">
          <section className="glass rounded-xl p-4 space-y-3">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse" />
              ))}
            </div>
          </section>
          <section className="glass rounded-xl p-4 space-y-4">
            <div className="h-6 w-64 rounded bg-muted animate-pulse" />
            <div className="h-4 w-96 rounded bg-muted/70 animate-pulse" />
            <div className="grid md:grid-cols-2 gap-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg border border-border bg-muted/40 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-lg border border-border bg-muted/30 animate-pulse" />
          </section>
        </div>
      ) : sheets.length === 0 ? (
        <div className="glass rounded-xl p-8 md:p-12">
          <div className="max-w-2xl mx-auto text-center">
            <ClipboardList className="size-10 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Comece sua primeira ficha técnica</h2>
            <p className="text-sm text-muted-foreground mb-6">
              A ficha é o coração do produto: reúne materiais (BOM), operações (BOP), medidas e custos.
              Assim que criada, o sistema calcula automaticamente custo total e sinaliza gates de OP.
            </p>
            <div className="grid md:grid-cols-3 gap-3 text-left mb-6">
              {[
                { n: "1", t: "Vincule ao produto", d: "Selecione o SKU. Se ainda não existe, use Quick Create." },
                { n: "2", t: "Preencha BOM + BOP", d: "Materiais e operações alimentam o custo automaticamente." },
                { n: "3", t: "Aprove e libere OP", d: "Ficha aprovada + piloto liberam a OP para o PCP." },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-border bg-background/30 p-4">
                  <div className="size-6 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center mb-2">{s.n}</div>
                  <div className="text-sm font-medium mb-1">{s.t}</div>
                  <div className="text-xs text-muted-foreground leading-5">{s.d}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button onClick={openCreate}>Criar ficha técnica</Button>
              <Button variant="outline" asChild>
                <a href="/produtos">Ir para produtos</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              💡 Dica: você também pode criar a ficha direto pelo Product Workspace, clicando em "Próximo passo" no produto.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <section className="glass rounded-xl p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Biblioteca de versões</div>
              <div className="text-xs text-muted-foreground">
                {sheets.length} fichas ativas no workspace
              </div>
            </div>
            <div className="space-y-2">
              {sheets.map((sheet) => {
                const product = products.find((item) => item.id === sheet.product_id);
                const active = sheet.id === selected?.id;
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setSelectedId(sheet.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? "border-primary/40 bg-primary/10" : "border-border bg-background/30 hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{sheet.code}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {product?.name || "Sem produto vinculado"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sheet.product_id && (
                          <ProductReadinessBadge productId={sheet.product_id} />
                        )}
                        <Badge variant="outline" className={COLOR[sheet.status]}>
                          {LABEL[sheet.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {sheet.version} · {new Date(sheet.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
                <ProductPreviewCard
                  product={selectedProduct}
                  code={selected.code}
                  version={selected.version}
                  status={selected.status}
                />

                <div className="glass rounded-xl p-5">
                  <div className="flex justify-end mb-3 gap-2">
                    <TechPackExportButton
                      sheetId={selected.id}
                      code={selected.code}
                      version={selected.version}
                      productName={selectedProduct?.name}
                      productSku={selectedProduct?.sku}
                      productImage={selectedProduct?.image_url}
                      status={selected.status}
                    />
                    <ApproveTechSheetButton
                      sheetId={selected.id}
                      status={selected.status}
                      isOwner={selected.owner_id === user?.id}
                    />
                    <BomTemplatesButton sheetId={selected.id} ownerId={selected.owner_id} />
                  </div>
                  <Tabs defaultValue="documento" className="space-y-4">
                    <TabsList className="w-full flex flex-wrap h-auto justify-start bg-transparent p-0 gap-2">
                      {[
                        ["documento", "Documento"],
                        ["materiais", "Materiais"],
                        ["operacoes", "Operações"],
                        ["medidas", "Medidas"],
                        ["consumo", "Consumo"],
                        ["custos", "Custos"],
                        ["documentos", "Anexos"],
                        ["ia", "IA"],
                      ].map(([value, label]) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className="rounded-lg border border-border bg-background/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="documento" className="mt-0">
                      <FichaDocument
                        status={selected.status}
                        completeness={completeness}
                        productName={selectedProduct?.name}
                        productSku={selectedProduct?.sku}
                        code={selected.code}
                        version={selected.version}
                        materials={docMaterials}
                        blockFields={{
                          composition: selectedContent.composition,
                          packaging: selectedContent.packaging,
                          treatments: selectedContent.treatments,
                          printing: selectedContent.printing,
                          embroidery: selectedContent.embroidery,
                          laundry: selectedContent.laundry,
                          quality: selectedContent.quality,
                        }}
                        observations={selectedContent.overview}
                        canEdit={canEdit}
                        onObservationChange={(v) =>
                          saveSheetContent.mutate({ ...selectedContent, overview: v })
                        }
                        onBlockChange={(block, items) => updateBlock(block, items)}
                      />
                    </TabsContent>
                    <TabsContent value="materiais" className="mt-0">
                      <MaterialsPanel
                        sheetId={selected.id}
                        ownerId={selected.owner_id}
                        canEdit={canEdit}
                      />
                    </TabsContent>
                    <TabsContent value="operacoes" className="mt-0">
                      <OperationsPanel
                        sheetId={selected.id}
                        ownerId={selected.owner_id}
                        canEdit={canEdit}
                      />
                    </TabsContent>
                    <TabsContent value="medidas" className="mt-0">
                      <MeasurementsPanel
                        sheetId={selected.id}
                        ownerId={selected.owner_id}
                        canEdit={canEdit}
                      />
                    </TabsContent>
                    <TabsContent value="consumo" className="mt-0">
                      <SectionList
                        title="Consumo"
                        icon={ClipboardList}
                        items={selectedContent.consumption}
                        emptyLabel="Nenhum consumo informado."
                      />
                    </TabsContent>
                    <TabsContent value="custos" className="mt-0">
                      <CostsPanel
                        sheetId={selected.id}
                        ownerId={selected.owner_id}
                        canEdit={canEdit}
                      />
                    </TabsContent>
                    <TabsContent value="documentos" className="mt-0">
                      <SectionList
                        title="Documentos e anexos"
                        icon={FileText}
                        items={selectedContent.documents}
                        emptyLabel="Nenhum documento referenciado."
                        chips
                      />
                    </TabsContent>
                    <TabsContent value="ia" className="mt-0">
                      <AiSuggestionsPanel sheetId={selected.id} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-4">
                <div className="glass rounded-xl p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold">Observações gerais</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Resumo central da engenharia de produto.
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/30 p-4 min-h-32 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                    {selectedContent.overview || "Sem observações gerais registradas."}
                  </div>
                </div>

                <div className="glass rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Histórico de versões</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Auditoria rápida por código técnico.
                      </div>
                    </div>
                    {versionHistory.length >= 2 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDiffOpen(true)}
                        className="gap-1 text-xs"
                      >
                        <Layers3 className="size-3.5" /> Comparar
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {versionHistory.map((sheet) => (
                      <div
                        key={sheet.id}
                        className="rounded-xl border border-border bg-background/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{sheet.version}</div>
                          <Badge variant="outline" className={COLOR[sheet.status]}>
                            {LABEL[sheet.status]}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(sheet.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selected.status === "aprovada" && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <Lock className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Ficha aprovada e bloqueada
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Esta versão está aprovada e bloqueada. Para alterar, crie uma nova versão.
                    </p>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        onClick={() => newVersion.mutate(selected)}
                        disabled={newVersion.isPending}
                        className="gap-2"
                        title={`Cria ${bumpVersion(selected.version)} a partir desta ficha`}
                      >
                        <Copy className="size-4" /> Criar nova versão (
                        {bumpVersion(selected.version)})
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selected.owner_id === user?.id && selected.status !== "aprovada" && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => openEdit(selected)} className="gap-2">
                    <Pencil className="size-4" /> Editar ficha
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSnapshotsOpen(true)}
                    className="gap-2"
                  >
                    <Camera className="size-4" /> Snapshots
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => newVersion.mutate(selected)}
                    disabled={newVersion.isPending}
                    className="gap-2"
                    title={`Cria ${bumpVersion(selected.version)} a partir desta ficha`}
                  >
                    <Copy className="size-4" /> Nova versão ({bumpVersion(selected.version)})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => del.mutate(selected.id)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" /> Remover
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <SheetDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setInitialProductId(null);
        }}
        editing={editing}
        initialProductId={initialProductId}
        userId={user?.id}
        products={products}
      />
      <VersionDiffDialog open={diffOpen} onOpenChange={setDiffOpen} versions={versionHistory} />
      {selectedId && (
        <TechSheetVersionsDrawer
          techSheetId={selectedId}
          open={snapshotsOpen}
          onOpenChange={setSnapshotsOpen}
        />
      )}
    </div>
  );
}

function ProductPreviewCard({
  product,
  code,
  version,
  status,
}: {
  product: ProductRef | null;
  code: string;
  version: string;
  status: Status;
}) {
  const { data: imageUrl } = useQuery({
    queryKey: ["tech-sheet-product-image", product?.image_url],
    queryFn: () => resolveProductImage(product?.image_url ?? null),
    enabled: Boolean(product?.image_url),
    staleTime: 50 * 60 * 1000,
  });

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="aspect-[4/4.8] bg-muted/20 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.name || code}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="size-full grid place-items-center text-muted-foreground">
            <FileText className="size-10 text-primary/70" />
          </div>
        )}
      </div>
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={COLOR[status]}>
            {LABEL[status]}
          </Badge>
          <Badge variant="outline">{version}</Badge>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-1">
            Produto
          </div>
          <div className="text-xl font-semibold tracking-tight">
            {product?.name || "Produto não vinculado"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {product?.sku || code}
            {product?.category ? ` · ${product.category}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionList({
  title,
  icon: Icon,
  items,
  emptyLabel,
  chips,
}: {
  title: string;
  icon: typeof FileText;
  items: string[];
  emptyLabel: string;
  chips?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Icon className="size-4 text-primary" /> {title}
      </div>
      {items.length ? (
        chips ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-xl border border-border bg-background/30 p-3 text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function SheetDialog({
  open,
  onOpenChange,
  editing,
  initialProductId,
  userId,
  products,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  editing: Sheet | null;
  initialProductId?: string | null;
  userId?: string;
  products: ProductRef[];
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [productId, setProductId] = useState("none");
  const [version, setVersion] = useState("v1.0");
  const [status, setStatus] = useState<Status>("rascunho");
  const [overview, setOverview] = useState("");
  const [materials, setMaterials] = useState("");
  const [operations, setOperations] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [consumption, setConsumption] = useState("");
  const [costs, setCosts] = useState("");
  const [documents, setDocuments] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const content = parseSheetContent(editing.content);
      setCode(editing.code);
      setProductId(editing.product_id ?? "none");
      setVersion(editing.version);
      setStatus(editing.status);
      setOverview(content.overview);
      setMaterials(content.materials.join("\n"));
      setOperations(content.operations.join("\n"));
      setMeasurements(content.measurements.join("\n"));
      setConsumption(content.consumption.join("\n"));
      setCosts(content.costs.join("\n"));
      setDocuments(content.documents.join("\n"));
      return;
    }
    reset();
    if (initialProductId) setProductId(initialProductId);
  }, [editing, open, initialProductId]);

  function reset() {
    setCode("");
    setProductId("none");
    setVersion("v1.0");
    setStatus("rascunho");
    setOverview("");
    setMaterials("");
    setOperations("");
    setMeasurements("");
    setConsumption("");
    setCosts("");
    setDocuments("");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      if (!code.trim()) throw new Error("Código obrigatório");
      const existing = editing ? parseSheetContent(editing.content) : null;
      const payload = {
        owner_id: userId,
        code: code.trim(),
        product_id: productId === "none" ? null : productId,
        version: version.trim() || "v1.0",
        status,
        content: stringifySheetContent({
          overview: overview.trim(),
          materials: splitLines(materials),
          operations: splitLines(operations),
          measurements: splitLines(measurements),
          consumption: splitLines(consumption),
          costs: splitLines(costs),
          documents: splitLines(documents),
          composition: existing?.composition ?? [],
          packaging: existing?.packaging ?? [],
          treatments: existing?.treatments ?? [],
          printing: existing?.printing ?? [],
          embroidery: existing?.embroidery ?? [],
          laundry: existing?.laundry ?? [],
          quality: existing?.quality ?? [],
        }),
      };
      if (editing) {
        const { error } = await supabase.from("tech_sheets").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tech_sheets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success(editing ? "Ficha atualizada" : "Ficha criada");
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) reset();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ficha técnica" : "Nova ficha técnica"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Código</Label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="FT-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Versão</Label>
              <Input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="v1.0"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LABEL).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações gerais</Label>
            <Textarea
              rows={4}
              value={overview}
              onChange={(event) => setOverview(event.target.value)}
              placeholder="Resumo técnico, revisão, alertas de engenharia..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Materiais</Label>
              <Textarea
                rows={5}
                value={materials}
                onChange={(event) => setMaterials(event.target.value)}
                placeholder="1 item por linha"
              />
            </div>
            <div className="space-y-2">
              <Label>Operações</Label>
              <Textarea
                rows={5}
                value={operations}
                onChange={(event) => setOperations(event.target.value)}
                placeholder="1 item por linha"
              />
            </div>
            <div className="space-y-2">
              <Label>Medidas</Label>
              <Textarea
                rows={5}
                value={measurements}
                onChange={(event) => setMeasurements(event.target.value)}
                placeholder="1 item por linha"
              />
            </div>
            <div className="space-y-2">
              <Label>Consumo</Label>
              <Textarea
                rows={5}
                value={consumption}
                onChange={(event) => setConsumption(event.target.value)}
                placeholder="1 item por linha"
              />
            </div>
            <div className="space-y-2">
              <Label>Custos</Label>
              <Textarea
                rows={5}
                value={costs}
                onChange={(event) => setCosts(event.target.value)}
                placeholder="1 item por linha"
              />
            </div>
            <div className="space-y-2">
              <Label>Documentos</Label>
              <Textarea
                rows={5}
                value={documents}
                onChange={(event) => setDocuments(event.target.value)}
                placeholder="SVG, PDF, DXF, PLT..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar ficha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function VersionDiffDialog({
  open,
  onOpenChange,
  versions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  versions: Sheet[];
}) {
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");

  useEffect(() => {
    if (open && versions.length >= 2) {
      setAId(versions[1].id);
      setBId(versions[0].id);
    }
  }, [open, versions]);

  const a = versions.find((v) => v.id === aId);
  const b = versions.find((v) => v.id === bId);
  const ca = parseSheetContent(a?.content ?? null);
  const cb = parseSheetContent(b?.content ?? null);

  const sections: Array<{ key: keyof SheetContent; label: string }> = [
    { key: "overview", label: "Observações" },
    { key: "materials", label: "Materiais" },
    { key: "operations", label: "Operações" },
    { key: "measurements", label: "Medidas" },
    { key: "consumption", label: "Consumo" },
    { key: "costs", label: "Custos" },
    { key: "documents", label: "Documentos" },
  ];

  const diff = (oldArr: string[] | string, newArr: string[] | string) => {
    const oldList = Array.isArray(oldArr) ? oldArr : oldArr ? [oldArr] : [];
    const newList = Array.isArray(newArr) ? newArr : newArr ? [newArr] : [];
    const oldSet = new Set(oldList);
    const newSet = new Set(newList);
    return {
      removed: oldList.filter((x) => !newSet.has(x)),
      added: newList.filter((x) => !oldSet.has(x)),
      unchanged: oldList.filter((x) => newSet.has(x)),
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar versões</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Versão A (anterior)</Label>
            <Select value={aId} onValueChange={setAId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.version} · {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Versão B (nova)</Label>
            <Select value={bId} onValueChange={setBId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.version} · {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {a && b && (
          <div className="space-y-3 mt-2">
            {sections.map(({ key, label }) => {
              const d = diff(ca[key] as string[] | string, cb[key] as string[] | string);
              if (d.added.length === 0 && d.removed.length === 0) {
                return (
                  <div key={key} className="rounded-lg border border-border bg-background/30 p-3">
                    <div className="text-xs font-semibold mb-1">{label}</div>
                    <div className="text-xs text-muted-foreground">Sem alterações.</div>
                  </div>
                );
              }
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-background/30 p-3 space-y-1"
                >
                  <div className="text-xs font-semibold">{label}</div>
                  {d.removed.map((x, i) => (
                    <div
                      key={`r-${i}`}
                      className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive line-through"
                    >
                      − {x}
                    </div>
                  ))}
                  {d.added.map((x, i) => (
                    <div
                      key={`a-${i}`}
                      className="text-xs px-2 py-1 rounded bg-success/10 text-success"
                    >
                      + {x}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AiSuggestionsPanel({ sheetId }: { sheetId: string }) {
  const run = useServerFn(suggestTechSheetImprovements);
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    try {
      const res = await run({ data: { techSheetId: sheetId } });
      setText(res.text);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Fashion-GPT — sugestões para esta ficha
          </div>
          <div className="text-xs text-muted-foreground">
            Analisa BOM, operações e custo e propõe otimizações.
          </div>
        </div>
        <Button size="sm" onClick={handleRun} disabled={loading}>
          {loading ? "Analisando…" : "Gerar análise"}
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-background/30 p-4 min-h-32 text-sm">
        {text ? (
          <Markdown content={text} />
        ) : (
          <div className="text-xs text-muted-foreground">
            Clique em "Gerar análise" para receber recomendações.
          </div>
        )}
      </div>
    </div>
  );
}

function ApproveTechSheetButton({
  sheetId,
  status,
  isOwner,
}: {
  sheetId: string;
  status: Status;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const approveFn = useServerFn(approveTechSheet);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => approveFn({ data: { sheetId, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Ficha aprovada — snapshot registrado.");
      setOpen(false);
      setNote("");
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
      qc.invalidateQueries({ queryKey: ["tech-sheet-by-product"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao aprovar."),
  });

  if (status === "aprovada") {
    return (
      <Badge variant="outline" className="bg-success/15 text-success border-success/30 gap-1">
        <ShieldCheck className="size-3" /> Aprovada
      </Badge>
    );
  }
  if (!isOwner) return null;

  return (
    <>
      <Button
        size="sm"
        variant="default"
        className="gap-1"
        onClick={() => setOpen(true)}
        title="Aprovar ficha (requer admin ou gerente)"
      >
        <ShieldCheck className="size-3.5" /> Aprovar ficha
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar ficha técnica</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground text-xs">
              A aprovação congela a versão atual e registra você como aprovador. Apenas admin ou
              gerente podem executar.
            </p>
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: liberada para corte do lote piloto"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-1">
              <ShieldCheck className="size-3.5" />
              {mut.isPending ? "Aprovando…" : "Confirmar aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

