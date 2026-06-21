import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Loader2 } from "lucide-react";
import { getScrapByOrder, type ScrapByOpRow } from "@/lib/inventory-scrap-analytics.functions";
import { Badge } from "@/components/ui/badge";

export function ScrapByOpPanel() {
  const fn = useServerFn(getScrapByOrder);
  const q = useQuery({
    queryKey: ["scrap-by-op"],
    queryFn: () => fn() as Promise<ScrapByOpRow[]>,
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-4 pb-2 text-sm font-medium">
        <Trash2 className="size-4 text-amber-600" />
        Sucata por OP (90 dias)
      </div>
      <div className="px-4 pb-4">
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="size-3.5 animate-spin" /> Calculando…
          </div>
        ) : !q.data?.length ? (
          <div className="text-xs text-muted-foreground py-4">
            Nenhuma sucata vinculada a OPs nos últimos 90 dias.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {q.data.map((r) => (
              <li
                key={r.production_order_id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{r.order_code}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {r.product_name ?? r.product_sku ?? "—"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.reason}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      r.scrap_pct >= 10
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : r.scrap_pct >= 5
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : ""
                    }`}
                  >
                    {r.scrap_pct}%
                  </Badge>
                  <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {r.scrap_qty}/{r.order_quantity}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
