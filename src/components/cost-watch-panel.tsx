import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, TrendingDown, AlertOctagon } from "lucide-react";
import { getCostWatch, type CostWatchItem } from "@/lib/cost-watch.functions";

function statusBadge(s: CostWatchItem["status"]) {
  switch (s) {
    case "ok":
      return <Badge className="bg-emerald-500/15 text-emerald-500 border-0">Na meta</Badge>;
    case "atencao":
      return <Badge className="bg-amber-500/15 text-amber-500 border-0">Atenção</Badge>;
    case "estouro":
      return <Badge className="bg-red-500/15 text-red-500 border-0">Estouro</Badge>;
    case "sem_meta":
      return <Badge variant="outline">Sem meta</Badge>;
    case "sem_ficha":
      return <Badge variant="outline">Sem ficha</Badge>;
  }
}

export function CostWatchPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["cost-watch"],
    queryFn: () => getCostWatch(),
  });

  const items = data?.items ?? [];
  const top = items.filter((i) => i.status === "estouro" || i.status === "atencao").slice(0, 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertOctagon className="size-4 text-primary" />
          Cost Watch — custo aprovado × meta
        </CardTitle>
        <CardDescription>
          Engenharia identifica produtos fora da meta antes da OP. IA aponta a causa raiz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Estouro" value={data.summary.estouro} tone="bad" />
            <Stat label="Atenção" value={data.summary.atencao} tone="warn" />
            <Stat label="Sem meta" value={data.summary.sem_meta} tone="neutral" />
            <Stat
              label="Gap médio"
              value={`${data.summary.avgGapPct > 0 ? "+" : ""}${data.summary.avgGapPct}%`}
              tone={data.summary.avgGapPct > 0 ? "warn" : "good"}
            />
          </div>
        )}

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
          <div className="text-sm text-muted-foreground">Analisando custos…</div>
        ) : top.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum produto fora da meta.</div>
        ) : (
          <div className="space-y-2">
            {top.map((i) => (
              <div
                key={i.productId}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                {i.imageUrl ? (
                  <img
                    src={i.imageUrl}
                    alt={i.name}
                    className="size-12 rounded-md object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="size-12 rounded-md bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm truncate">{i.name}</div>
                    {statusBadge(i.status)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {i.sku} · meta R$ {i.targetCost.toFixed(2)} · aprovado R$ {i.approvedCost.toFixed(2)}
                  </div>
                  <div className="text-xs mt-0.5">{i.hint}</div>
                </div>
                <div
                  className={`text-sm font-semibold tabular-nums shrink-0 flex items-center gap-1 ${
                    i.gapPct > 0 ? "text-red-500" : "text-emerald-500"
                  }`}
                >
                  {i.gapPct > 0 ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                  {i.gapPct > 0 ? "+" : ""}
                  {i.gapPct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "bad"
      ? "text-red-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "good"
          ? "text-emerald-500"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
