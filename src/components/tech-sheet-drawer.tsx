import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, ImageIcon, Ruler, Layers, ListChecks, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MaterialsPanel, OperationsPanel, MeasurementsPanel } from "@/components/tech-pack/panels";

type Props = {
  productId: string | null | undefined;
  productName?: string | null;
  productSku?: string | null;
  productImage?: string | null;
  orderCode?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/** Drawer rápido com a ficha técnica do produto — sem sair da tela do lote. */
export function TechSheetDrawer({
  productId,
  productName,
  productSku,
  productImage,
  orderCode,
  open,
  onOpenChange,
}: Props) {
  const { data: sheet, isLoading } = useQuery({
    enabled: open && !!productId,
    queryKey: ["tech-sheet-by-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheets")
        .select(
          "id, owner_id, code, version, status, materials_cost, labor_cost, cost_price, overhead_pct, updated_at",
        )
        .eq("product_id", productId as string)
        .order("status", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Ficha técnica ·{" "}
            <span className="font-mono text-xs text-muted-foreground">
              {orderCode ?? productSku ?? "—"}
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Tudo o que a produção precisa saber sobre essa referência.
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-3 mt-4">
          <div className="size-20 rounded-lg overflow-hidden bg-muted/40 shrink-0">
            {productImage ? (
              <img src={productImage} alt={productName ?? ""} className="size-full object-cover" />
            ) : (
              <div className="size-full grid place-items-center text-[10px] text-muted-foreground">
                <ImageIcon className="size-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{productName ?? "—"}</div>
            <div className="text-xs text-muted-foreground font-mono">{productSku ?? "—"}</div>
            {sheet && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                <Badge variant="outline" className="text-[10px]">
                  v{sheet.version}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${sheet.status === "aprovada" ? "bg-success/15 text-success border-success/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}
                >
                  {sheet.status}
                </Badge>
                {sheet.cost_price != null && (
                  <Badge variant="outline" className="text-[10px]">
                    custo R$ {Number(sheet.cost_price).toFixed(2)}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {productId && (
            <Link
              to="/ficha-tecnica"
              search={{ product: productId } as any}
              className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted h-fit"
              title="Abrir ficha completa"
            >
              <ExternalLink className="size-3" /> Completa
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="mt-6 text-sm text-muted-foreground">Carregando ficha…</div>
        ) : !sheet ? (
          <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Esta referência ainda não possui ficha técnica.
            {productId && (
              <div className="mt-2">
                <Link
                  to="/ficha-tecnica"
                  search={{ product: productId } as any}
                  className="text-primary hover:underline text-xs"
                >
                  Criar ficha técnica →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <Tabs defaultValue="materials" className="mt-5">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="materials" className="text-xs gap-1">
                <Layers className="size-3.5" />
                Materiais
              </TabsTrigger>
              <TabsTrigger value="operations" className="text-xs gap-1">
                <ListChecks className="size-3.5" />
                Processo
              </TabsTrigger>
              <TabsTrigger value="measurements" className="text-xs gap-1">
                <Ruler className="size-3.5" />
                Medidas
              </TabsTrigger>
            </TabsList>
            <TabsContent value="materials" className="mt-3">
              <MaterialsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </TabsContent>
            <TabsContent value="operations" className="mt-3">
              <OperationsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </TabsContent>
            <TabsContent value="measurements" className="mt-3">
              <MeasurementsPanel sheetId={sheet.id} ownerId={sheet.owner_id} canEdit={false} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Trigger button + drawer in one place. */
export function TechSheetDrawerTrigger(
  props: Omit<Props, "open" | "onOpenChange"> & { className?: string; label?: string },
) {
  const [open, setOpen] = useState(false);
  const { className, label = "Ficha", ...rest } = props;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          "flex flex-col items-center gap-0.5 py-1.5 rounded-md hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground"
        }
        title="Abrir ficha técnica"
      >
        <FileText className="size-3.5" />
        <span>{label}</span>
      </button>
      <TechSheetDrawer {...rest} open={open} onOpenChange={setOpen} />
    </>
  );
}
