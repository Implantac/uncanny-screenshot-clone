import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Package, ImageIcon, FileText, ChevronRight } from "lucide-react";
import { ProductionTechSheetDrawer } from "./production-tech-sheet-drawer";

type Props = {
  batchCode: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type Ref = {
  id: string;
  code: string;
  quantity: number;
  progress: number;
  stage: string;
  product: { id: string; name: string; sku: string; image_url: string | null } | null;
};

export function LoteReferencesDrawer({ batchCode, open, onOpenChange }: Props) {
  const [picked, setPicked] = useState<{ productId: string; orderId: string; orderCode: string } | null>(null);

  const { data: refs = [], isLoading } = useQuery({
    enabled: open && !!batchCode,
    queryKey: ["lote-refs", batchCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, code, quantity, progress, stage, products(id, name, sku, image_url)")
        .eq("batch_code", batchCode as string)
        .order("code");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        product: r.products ?? null,
      })) as Ref[];
    },
  });

  const totalQty = refs.reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="size-4 text-primary" /> Lote{" "}
              <span className="font-mono text-sm">{batchCode ?? "—"}</span>
            </SheetTitle>
            <SheetDescription className="text-xs">
              {refs.length} referência{refs.length === 1 ? "" : "s"} · {totalQty.toLocaleString("pt-BR")} peças. Toque numa peça
              para abrir a ficha de produção.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Carregando referências…</div>
            ) : refs.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
                Sem ordens nesse lote.
              </div>
            ) : (
              refs.map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    r.product &&
                    setPicked({ productId: r.product.id, orderId: r.id, orderCode: r.code })
                  }
                  disabled={!r.product}
                  className="w-full text-left rounded-lg border border-border bg-card p-2.5 flex items-center gap-3 hover:border-primary/50 transition disabled:opacity-50"
                >
                  <div className="size-12 rounded-md overflow-hidden bg-muted shrink-0">
                    {r.product?.image_url ? (
                      <img src={r.product.image_url} alt={r.product.name} className="size-full object-cover" />
                    ) : (
                      <div className="size-full grid place-items-center text-muted-foreground">
                        <ImageIcon className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.product?.name ?? "Produto removido"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {r.code} · {r.product?.sku ?? "—"}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      <span>{r.quantity} pç</span>
                      <span>{r.progress}%</span>
                      <span className="uppercase">{r.stage}</span>
                    </div>
                  </div>
                  <FileText className="size-4 text-primary shrink-0" />
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ProductionTechSheetDrawer
        productId={picked?.productId}
        productionOrderId={picked?.orderId}
        orderCode={picked?.orderCode}
        open={!!picked}
        onOpenChange={(v) => !v && setPicked(null)}
      />
    </>
  );
}
