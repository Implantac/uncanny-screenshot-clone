import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSuggestedRetailPrice } from "@/lib/product-cost-engine.functions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Loader2, Calculator, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type Props = {
  productId: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * ProductPriceSuggestionCard — Card reativo que mostra
 * preço sugerido com base no custo + margem alvo + markup.
 * Inclui break-even analysis + auto-fill sell_price (Item 9).
 */
export function ProductPriceSuggestionCard({ productId }: Props) {
  const fn = useServerFn(getSuggestedRetailPrice);
  const qc = useQueryClient();
  const [applying, setApplying] = useState(false);

  const { data, isLoading } = useQuery({
    enabled: !!productId,
    queryKey: ["product-suggested-price", productId],
    queryFn: () => fn({ data: { productId } }),
    staleTime: 30_000,
  });

  const autoFill = async () => {
    if (!data?.suggestedPrice) return;
    setApplying(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ sell_price: data.suggestedPrice })
        .eq("id", productId);
      if (error) throw error;
      toast.success(`Preço de venda atualizado para ${brl(data.suggestedPrice)}`);
      qc.invalidateQueries({ queryKey: ["product-workspace", productId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

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

  const statusColor = isAbove
    ? "text-rose-600"
    : isBelow
      ? "text-emerald-600"
      : "text-muted-foreground";

  // Break-even analysis
  const suggested = data.suggestedPrice ?? 0;
  const cost = data.currentCost ?? 0;
  const margin = cost > 0 && suggested > 0
    ? ((suggested - cost) / suggested) * 100
    : null;
  const markup = cost > 0 && suggested > 0
    ? ((suggested - cost) / cost) * 100
    : null;
  const minMarginPct = data.targetMarginPct ?? 30;
  const minPrice = cost > 0
    ? cost / (1 - minMarginPct / 100)
    : 0;

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

      {/* Break-even analysis */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Calculator className="size-3" />
          Análise de break-even
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-muted-foreground">Margem:</span>{" "}
            <span className={`font-semibold ${margin != null && margin >= minMarginPct ? "text-emerald-600" : "text-amber-600"}`}>
              {margin != null ? `${margin.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Markup:</span>{" "}
            <span className="font-semibold">
              {markup != null ? `${markup.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Preço mínimo ({minMarginPct}% margem):</span>{" "}
            <span className="font-semibold tabular-nums">{brl(minPrice)}</span>
          </div>
        </div>
      </div>

      {/* Auto-fill sell_price button */}
      {data.suggestedPrice != null && (
        <Button
          size="sm"
          className="w-full gap-1.5 h-8 text-xs"
          disabled={applying}
          onClick={autoFill}
        >
          {applying ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          {applying ? "Aplicando…" : `Aplicar ${brl(data.suggestedPrice)} como preço de venda`}
        </Button>
      )}
    </div>
  );
}
