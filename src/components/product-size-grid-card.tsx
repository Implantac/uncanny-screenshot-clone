import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSizeGrids } from "@/lib/size-grids.functions";
import { supabase } from "@/integrations/supabase/client";
import { Ruler, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type Props = {
  productId: string;
  category: string | null;
};

/**
 * ProductSizeGridCard — Card que mostra a grade de tamanhos
 * aplicada ao produto (por categoria ou produto específico).
 */
export function ProductSizeGridCard({ productId, category }: Props) {
  const [expanded, setExpanded] = useState(false);
  const list = useServerFn(listSizeGrids);

  const { data: product } = useQuery({
    enabled: !!productId,
    queryKey: ["product-sizes", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("sizes, grade")
        .eq("id", productId)
        .maybeSingle();
      return data as { sizes: string[] | null; grade: string | null } | null;
    },
  });

  const { data: grids } = useQuery({
    queryKey: ["size-grids"],
    queryFn: () => list(),
  });

  const matchedGrid = useMemo(() => {
    if (!grids) return null;
    // Priority: product-specific > category > general
    const productGrid = grids.find(
      (g: any) =>
        g.scope === "product" && g.product_id === productId,
    );
    if (productGrid) return productGrid;
    if (category) {
      const catGrid = grids.find(
        (g: any) => g.scope === "category" && g.scope_value === category,
      );
      if (catGrid) return catGrid;
    }
    return null;
  }, [grids, productId, category]);

  const sizes = product?.sizes ?? [];
  const distribution = matchedGrid?.distribution as Record<string, number> | undefined;
  const totalPct = distribution
    ? Object.values(distribution).reduce((a, b) => a + b, 0)
    : 0;

  if (!sizes.length && !matchedGrid) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Ruler className="size-4 text-primary" />
          <span className="text-sm font-semibold">Grade de Tamanhos</span>
          {matchedGrid && (
            <Badge variant="outline" className="text-[9px]">
              {matchedGrid.scope}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {sizes.length || (distribution ? Object.keys(distribution).length : 0)} tamanhos
          </span>
          {expanded ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Chips de tamanho */}
          <div className="flex flex-wrap gap-1.5">
            {(sizes.length > 0
              ? sizes
              : distribution
                ? Object.keys(distribution)
                : []
            ).map((size) => {
              const pct = distribution?.[size];
              return (
                <Badge
                  key={size}
                  variant="outline"
                  className="text-[10px] gap-1 px-2 py-0.5"
                >
                  {size}
                  {pct != null && (
                    <span className="text-muted-foreground font-mono">
                      {(pct * 100).toFixed(0)}%
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>

          {/* Barra de distribuição */}
          {distribution && totalPct > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {Object.entries(distribution).map(([size, pct]) => (
                <div
                  key={size}
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(pct / totalPct) * 100}%` }}
                  title={`${size}: ${(pct * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          )}

          {/* Grade name */}
          {matchedGrid?.notes && (
            <div className="text-[10px] text-muted-foreground italic">
              {matchedGrid.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

