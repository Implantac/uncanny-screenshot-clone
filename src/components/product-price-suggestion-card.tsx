import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSuggestedRetailPrice } from "@/lib/product-cost-engine.functions";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

type Props = {
  productId: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * ProductPriceSuggestionCard — Card reativo que mostra
 * preço sugerido com base no custo + margem alvo + markup.
 */
export function ProductPriceSuggestionCard({ productId }: Props) {
  const fn = useServerFn(getSuggestedRetailPrice);
  const { data, isLoading } = useQuery({
    enabled: !!productId,
    queryKey: ["product-suggested-price", productId],
    queryFn: () => fn({ data: { productId } }),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Calculando preço sugerido…
      </div>
    );
  }

  if (!data?.currentCost) return null;

  const isAbove = data.gapPct != null && data.gapPct > 0;
  const isBelow = data.gapPct != null && data.gapPct < 0;
  const isOn = data.gapPct != null && Math.abs(data.gapPct) < 2;

  const statusColor = isAbove
    ? "text-rose-600"
    : isBelow
      ? "text-emerald-600"
      : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Preço Sugerido
        </div>
        {data.currentRetail != null && (
          <Badge variant="outline" className="text-[9px]">
            Atual: {brl(data.currentRetail)}
          </Badge>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="text-2xl font-bold tabular-nums">
          {data.suggestedPrice != null ? brl(data.suggestedPrice) : "—"}
        </div>
        {data.targetMarginPct != null && (
          <div className="text-xs text-muted-foreground mb-1">
            margem alvo {data.targetMarginPct}%
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Custo:</span>
        <span className="font-semibold tabular-nums">
          {brl(data.currentCost)}
        </span>
        {data.gapPct != null && (
          <>
            {isAbove ? (
              <TrendingUp className="size-3 text-rose-500" />
            ) : isBelow ? (
              <TrendingDown className="size-3 text-emerald-500" />
            ) : (
              <Minus className="size-3 text-muted-foreground" />
            )}
            <span className={statusColor}>
              {isAbove ? "↑" : isBelow ? "↓" : "•"} {Math.abs(data.gapPct).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              {isAbove
                ? " acima do atual"
                : isBelow
                  ? " abaixo do atual"
                  : " igual ao atual"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

