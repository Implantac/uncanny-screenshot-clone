import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  FichaDocument,
  type FichaDocumentProps,
  type DocMaterial,
  type SheetBlock,
  type SkuVariant,
  type CompletenessItem,
} from "@/components/tech-pack/sheet-document";

export const Route = createFileRoute("/portal/fornecedor/$token/ficha/$sheetId")({
  head: () => ({
    meta: [
      { title: "Ficha Técnica · Portal do Fornecedor · USE MODA OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SupplierSheetViewPage,
});

type SheetStatus = "rascunho" | "em_revisao" | "aprovada";

type ApiResponse = {
  sheet: { code: string; version: string; status: SheetStatus };
  product: { id: string; name: string; sku: string; image_url: string | null } | null;
  materials: Array<{
    id: string;
    name: string;
    type: string | null;
    code: string | null;
    description: string | null;
    color: string | null;
    unit: string;
    consumption: number;
    loss_pct: number;
  }>;
  measurements: Array<{
    point: string;
    tolerance_plus: number;
    tolerance_minus: number;
    sizes: Record<string, number>;
  }>;
  blocks: Record<string, SheetBlock[]>;
  overview: string;
  skuVariants: SkuVariant[];
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

function SupplierSheetViewPage() {
  const { token, sheetId } = Route.useParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/public/supplier-portal-ficha/${token}/${sheetId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 410) throw new Error("Link expirado.");
          if (res.status === 404) throw new Error("Ficha não encontrada.");
          if (res.status === 403) throw new Error("Acesso negado.");
          throw new Error("Falha ao carregar a ficha.");
        }
        return res.json();
      })
      .then((json: ApiResponse) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, sheetId]);

  const materials = useMemo<DocMaterial[]>(
    () =>
      (data?.materials ?? []).map((m) => ({
        ...m,
        supplier: null,
        unit_cost: 0,
        total_cost: 0,
      })),
    [data],
  );

  const completeness = useMemo<CompletenessItem[]>(() => {
    if (!data) return [];
    const blocks = data.blocks ?? {};
    const hasBlocks = BLOCK_KEYS.some((k) => (blocks[k] ?? []).length > 0);
    return [
      {
        key: "dados",
        label: "Dados gerais preenchidos",
        ok: Boolean(data.sheet.code && data.product),
      },
      { key: "imagem", label: "Imagem principal enviada", ok: Boolean(data.product?.image_url) },
      { key: "materiais", label: "Materiais definidos", ok: (data.materials ?? []).length > 0 },
      { key: "grade", label: "Grade definida", ok: (data.measurements ?? []).length > 0 },
      { key: "medidas", label: "Medidas preenchidas", ok: (data.measurements ?? []).length > 0 },
      { key: "blocos", label: "Blocos técnicos preenchidos", ok: hasBlocks },
      { key: "observacoes", label: "Observações preenchidas", ok: Boolean(data.overview) },
      { key: "sku", label: "SKUs geradas", ok: (data.skuVariants ?? []).length > 0 },
    ];
  }, [data]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando ficha…
      </div>
    );

  if (error || !data)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-destructive">{error ?? "Ficha indisponível."}</div>
          <Link
            to="/portal/fornecedor/$token"
            params={{ token }}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao portal
          </Link>
        </div>
      </div>
    );

  const blockFields: FichaDocumentProps["blockFields"] = {
    composition: data.blocks?.composition ?? [],
    packaging: data.blocks?.packaging ?? [],
    treatments: data.blocks?.treatments ?? [],
    printing: data.blocks?.printing ?? [],
    embroidery: data.blocks?.embroidery ?? [],
    laundry: data.blocks?.laundry ?? [],
    quality: data.blocks?.quality ?? [],
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              to="/portal/fornecedor/$token"
              params={{ token }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Portal do Fornecedor
            </Link>
          </div>
          <Badge variant="outline" className="gap-1">
            <FileText className="size-3" /> Modo fornecedor · somente leitura
          </Badge>
        </header>

        <FichaDocument
          status={data.sheet.status}
          completeness={completeness}
          productName={data.product?.name}
          productSku={data.product?.sku}
          code={data.sheet.code}
          version={data.sheet.version}
          materials={materials}
          blockFields={blockFields}
          observations={data.overview}
          skuVariants={data.skuVariants}
          canEdit={false}
          supplierView
        />
      </div>
    </div>
  );
}
