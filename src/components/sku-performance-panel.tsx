import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Sparkles, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Variant = { id: string; sku: string; color_id: string | null; size_id: string | null };
type Color = { id: string; name: string; hex: string | null };
type Size = { id: string; label: string };

type Props = {
  productId: string;
  variants: Variant[];
  colors: Color[];
  sizes: Size[];
};

/**
 * Histórico de performance por SKU: lê erp_sales_mirror, cruza por SKU
 * com variantes do produto e mostra ranking de cor/tamanho dos últimos 12 meses.
 * Recomenda a grade para a próxima coleção baseado no que realmente vende.
 */
export function SkuPerformancePanel({ productId, variants, colors, sizes }: Props) {
  const skuList = useMemo(() => variants.map((v) => v.sku).filter(Boolean), [variants]);

  const { data: sales = [], isLoading } = useQuery({
    enabled: !!productId && skuList.length > 0,
    queryKey: ["sku-performance", productId, skuList.join(",")],
    queryFn: async () => {
      const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("erp_sales_mirror")
        .select("sku, quantity, total_value, sold_at")
        .in("sku", skuList)
        .gte("sold_at", since)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const bySku = new Map<string, { qty: number; value: number }>();
    for (const s of sales) {
      if (!s.sku) continue;
      const cur = bySku.get(s.sku) ?? { qty: 0, value: 0 };
      cur.qty += Number(s.quantity ?? 0);
      cur.value += Number(s.total_value ?? 0);
      bySku.set(s.sku, cur);
    }
    const cMap = new Map(colors.map((c) => [c.id, c]));
    const sMap = new Map(sizes.map((s) => [s.id, s]));
    const colorAgg = new Map<string, { name: string; hex: string | null; qty: number; value: number }>();
    const sizeAgg = new Map<string, { label: string; qty: number; value: number }>();
    let totalQty = 0;
    for (const v of variants) {
      const perf = bySku.get(v.sku);
      if (!perf) continue;
      totalQty += perf.qty;
      if (v.color_id && cMap.has(v.color_id)) {
        const c = cMap.get(v.color_id)!;
        const cur = colorAgg.get(v.color_id) ?? { name: c.name, hex: c.hex, qty: 0, value: 0 };
        cur.qty += perf.qty; cur.value += perf.value;
        colorAgg.set(v.color_id, cur);
      }
      if (v.size_id && sMap.has(v.size_id)) {
        const s = sMap.get(v.size_id)!;
        const cur = sizeAgg.get(v.size_id) ?? { label: s.label, qty: 0, value: 0 };
        cur.qty += perf.qty; cur.value += perf.value;
        sizeAgg.set(v.size_id, cur);
      }
    }
    const topColors = [...colorAgg.values()].sort((a, b) => b.qty - a.qty);
    const topSizes = [...sizeAgg.values()].sort((a, b) => b.qty - a.qty);
    return { topColors, topSizes, totalQty, salesCount: sales.length };
  }, [sales, variants, colors, sizes]);

  if (!productId) return null;

  const maxColorQty = stats.topColors[0]?.qty || 1;
  const maxSizeQty = stats.topSizes[0]?.qty || 1;
  const totalVal = stats.topColors.reduce((a, b) => a + b.value, 0);

  return (
    <div className="lg:col-span-2 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-medium">Performance histórica (12m)</h2>
          {stats.totalQty > 0 && (
            <Badge variant="outline" className="ml-2 text-[11px]">
              {stats.totalQty.toLocaleString("pt-BR")} un · R$ {totalVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{stats.salesCount} vendas casadas por SKU</div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico…</div>
      ) : stats.totalQty === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <BarChart3 className="size-8 text-muted-foreground/50 mx-auto mb-2" />
          Sem vendas registradas para estes SKUs nos últimos 12 meses.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Cores que vendem</div>
            {stats.topColors.map((c, i) => (
              <div key={`${c.name}-${i}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-3.5 rounded border border-border shrink-0" style={{ background: c.hex ?? "transparent" }} />
                    <span className="truncate">{c.name}</span>
                    {i === 0 && <Badge className="h-4 text-[9px] gap-0.5"><Sparkles className="size-2.5" /> top</Badge>}
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground">{c.qty} un</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(c.qty / maxColorQty) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Tamanhos que vendem</div>
            {stats.topSizes.map((s, i) => (
              <div key={`${s.label}-${i}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{s.label}</span>
                    {i === 0 && <Badge className="h-4 text-[9px] gap-0.5"><Sparkles className="size-2.5" /> top</Badge>}
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground">{s.qty} un</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(s.qty / maxSizeQty) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.totalQty > 0 && (
        <div className="px-4 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Sugestão para próxima coleção:</span>{" "}
          mantenha {stats.topColors.slice(0, 3).map((c) => c.name).join(", ")}
          {stats.topSizes.length > 0 && <> · reforce grade em {stats.topSizes.slice(0, 3).map((s) => s.label).join("/")}</>}.
        </div>
      )}
    </div>
  );
}
