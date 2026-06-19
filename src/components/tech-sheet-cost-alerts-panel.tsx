import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { getTechSheetCostAlerts } from "@/lib/tech-sheet-cost-alerts.functions";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DRIVER_LABEL: Record<string, string> = {
  material: "Material",
  labor: "Mão de obra",
  overhead: "Overhead",
  misto: "Misto",
};

export function TechSheetCostAlertsPanel() {
  const fn = useServerFn(getTechSheetCostAlerts);
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["tech-sheet-cost-alerts"],
    queryFn: () => fn(),
    refetchInterval: 90_000,
  });

  if (isLoading) return <Card className="p-4 h-24 animate-pulse bg-muted/30" />;

  if (alerts.length === 0) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <ShieldCheck className="size-5 text-emerald-400" />
        <div className="text-sm">
          <div className="font-medium">Custos sob controle</div>
          <div className="text-muted-foreground text-xs">
            Nenhuma ficha com variação &gt;10% vs versão anterior.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-widest">
            Variação de custo &gt; 10%
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {alerts.length} ficha(s)
        </Badge>
      </div>
      <div className="grid gap-2">
        {alerts.slice(0, 10).map((a) => {
          const up = a.variationPct > 0;
          const Trend = up ? TrendingUp : TrendingDown;
          return (
            <div
              key={a.techSheetId}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-2.5"
            >
              <Trend
                className={`size-4 shrink-0 ${up ? "text-red-400" : "text-emerald-400"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {a.productName ?? a.sku ?? a.techSheetId.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  v{a.fromVersion} → atual · driver: {DRIVER_LABEL[a.driver]}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm font-mono font-semibold ${up ? "text-red-400" : "text-emerald-400"}`}
                >
                  {up ? "+" : ""}
                  {a.variationPct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {brl(a.previousCost)} → {brl(a.currentCost)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
