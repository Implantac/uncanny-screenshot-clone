import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, TrendingDown, TrendingUp, Target, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getProductCostSnapshot } from "@/lib/product-cost-snapshot.functions";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

/** Cost Cockpit — Onda 4: Meta × Real × Mercado + drivers de custo. */
export function ProductCostCockpit({ productId }: { productId: string }) {
  const call = useServerFn(getProductCostSnapshot);
  const { data, isLoading, error } = useQuery({
    queryKey: ["product-cost-snapshot", productId],
    queryFn: () => call({ data: { productId } }),
  });

  const aiQuestion = useMemo(() => {
    if (!data) return undefined;
    const parts: string[] = [];
    parts.push(`Produto ${data.sku ?? data.productName}.`);
    if (data.sheet) {
      parts.push(
        `Custo total R$ ${data.sheet.totalCost.toFixed(2)} (materiais R$ ${data.sheet.materialsCost.toFixed(2)}, MOD R$ ${data.sheet.laborCost.toFixed(2)}, overhead R$ ${data.sheet.overheadCost.toFixed(2)}).`,
      );
    }
    if (data.target.cost != null) parts.push(`Meta R$ ${data.target.cost.toFixed(2)}.`);
    if (data.market.avgSalePrice != null)
      parts.push(
        `Preço médio de venda 90d R$ ${data.market.avgSalePrice.toFixed(2)} em ${data.market.unitsSold90d} un.`,
      );
    if (data.drivers.length)
      parts.push(
        `Top drivers: ${data.drivers
          .map((d) => `${d.name} (${d.weightPct.toFixed(0)}%)`)
          .join(", ")}.`,
      );
    parts.push(
      "Analise o gap vs meta, a margem contra o preço real e sugira 3 ações concretas de redução de custo priorizando o driver de maior peso.",
    );
    return parts.join(" ");
  }, [data]);

  if (isLoading) {
    return <div className="h-40 bg-muted/40 rounded-xl animate-pulse" />;
  }
  if (error) {
    return (
      <div className="text-xs text-destructive">
        Falha ao calcular custo: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const s = data.sheet;
  const statusTone: Record<string, string> = {
    ok: "bg-success/15 text-success border-success/30",
    atencao: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    estouro: "bg-destructive/15 text-destructive border-destructive/30",
    sem_meta: "bg-muted text-muted-foreground",
    sem_ficha: "bg-muted text-muted-foreground",
  };
  const statusLabel: Record<string, string> = {
    ok: "Meta respeitada",
    atencao: "Atenção",
    estouro: "Estouro de meta",
    sem_meta: "Sem meta definida",
    sem_ficha: "Sem ficha aprovada",
  };

  return (
    <div className="space-y-4">
      {/* Header cards: Meta × Real × Preço */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card
          icon={<Target className="size-4" />}
          label="Meta"
          value={data.target.cost != null ? fmt(data.target.cost) : "—"}
          hint={data.target.marginPct != null ? `margem-alvo ${data.target.marginPct.toFixed(1)}%` : "sem meta"}
        />
        <Card
          icon={<DollarSign className="size-4" />}
          label="Custo real"
          value={s ? fmt(s.totalCost) : "—"}
          hint={s ? `ficha ${s.status}` : "sem ficha"}
        />
        <Card
          icon={<TrendingUp className="size-4" />}
          label="Preço médio 90d"
          value={data.market.avgSalePrice != null ? fmt(data.market.avgSalePrice) : "—"}
          hint={`${data.market.unitsSold90d} un · ${fmt(data.market.revenue90d)}`}
        />
        <Card
          icon={data.gap.pctVsTarget != null && data.gap.pctVsTarget > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          label="Gap vs meta"
          value={
            data.gap.pctVsTarget != null
              ? `${data.gap.pctVsTarget >= 0 ? "+" : ""}${data.gap.pctVsTarget.toFixed(1)}%`
              : "—"
          }
          hint={
            data.gap.marginPct != null ? `margem real ${data.gap.marginPct.toFixed(1)}%` : "sem venda"
          }
          badge={
            <Badge variant="outline" className={`text-[10px] ${statusTone[data.gap.status]}`}>
              {statusLabel[data.gap.status]}
            </Badge>
          }
        />
      </div>

      {/* Waterfall visual (barras horizontais) */}
      {s && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Composição do custo
          </div>
          <Bar label="Materiais" value={s.materialsCost} total={s.totalCost} color="bg-primary" />
          <Bar label="Mão de obra" value={s.laborCost} total={s.totalCost} color="bg-emerald-500" />
          <Bar
            label={`Overhead (${s.overheadPct.toFixed(1)}%)`}
            value={s.overheadCost}
            total={s.totalCost}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Top drivers de custo */}
      {data.drivers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Top drivers de custo (materiais)
          </div>
          <div className="space-y-2">
            {data.drivers.map((d) => (
              <div key={d.materialId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.name}</div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden mt-1">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, d.weightPct)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{fmt(d.totalCost)}</div>
                  <div className="text-[10px] text-muted-foreground">{d.weightPct.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-3 inline-flex items-center gap-1">
            <Sparkles className="size-3" /> Sensibilidade: reduzir 10% no driver #1 poupa {" "}
            <span className="font-semibold text-foreground">
              {data.drivers[0] ? fmt(data.drivers[0].totalCost * 0.1) : "—"}
            </span>{" "}
            por peça.
          </div>
        </div>
      )}

      {/* AI insight contextual */}
      <AICoordinatorPanel
        persona="development"
        title="Insight de custo (IA)"
        question={aiQuestion}
        autoLoad={false}
      />
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide inline-flex items-center gap-1">
          {icon}
          {label}
        </div>
        {badge}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmt(value)} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
