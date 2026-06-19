import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Lightbulb, AlertTriangle } from "lucide-react";
import { getCellEfficiency, type CellEfficiency } from "@/lib/cell-efficiency.functions";

function statusBadge(s: CellEfficiency["status"]) {
  switch (s) {
    case "ok":
      return <Badge className="bg-emerald-500/15 text-emerald-500 border-0">Saudável</Badge>;
    case "abaixo":
      return <Badge className="bg-amber-500/15 text-amber-500 border-0">Abaixo da meta</Badge>;
    case "ocioso":
      return <Badge className="bg-red-500/15 text-red-500 border-0">Ociosa</Badge>;
    case "sem_capacidade":
      return <Badge variant="outline">Sem capacidade</Badge>;
  }
}

export function CellEfficiencyPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["cell-efficiency"],
    queryFn: () => getCellEfficiency(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-primary" />
          Eficiência por célula (últimos {data?.windowDays ?? 30}d)
        </CardTitle>
        <CardDescription>
          Throughput real ÷ capacidade declarada. IA aponta gargalos e células ociosas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.insights?.length ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            {data.insights.map((i, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Lightbulb className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{i}</span>
              </div>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Calculando…</div>
        ) : !data?.cells.length ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="size-4" />
            Sem dados de produção neste período.
          </div>
        ) : (
          <div className="space-y-3">
            {data.cells.map((c) => (
              <div
                key={c.supplierId}
                className="rounded-lg border border-border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">{c.supplierName}</div>
                  {statusBadge(c.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>Real: <b className="text-foreground">{c.observedPerDay}/dia</b></span>
                  <span>Capacidade: <b className="text-foreground">{c.declaredPerDay}/dia</b></span>
                  <span className="ml-auto">{c.totalProduced} pçs no período</span>
                </div>
                {c.declaredPerDay > 0 && (
                  <Progress value={Math.min(100, c.efficiencyPct)} className="h-1.5" />
                )}
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
