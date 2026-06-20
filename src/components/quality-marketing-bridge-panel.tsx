import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Lightbulb, AlertTriangle, TrendingDown, Package } from "lucide-react";
import { getMarketingBridgeAnalysis } from "@/lib/quality-marketing-bridge.functions";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function QualityMarketingBridgePanel() {
  const fn = useServerFn(getMarketingBridgeAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["quality-marketing-bridge"],
    queryFn: () => fn(),
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="h-4 w-40 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }
  if (!data) return null;

  const { rows, summary, insight } = data;

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Megaphone className="size-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">Marketing × Qualidade</h2>
          <p className="text-xs text-muted-foreground">
            Onde o investimento de marca encontra (ou colide com) a qualidade — últimos 90 dias
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Produtos" value={String(summary.productsTracked)} />
        <Kpi label="Críticos" value={String(summary.criticos)} tone={summary.criticos ? "danger" : "ok"} />
        <Kpi label="Investido" value={fmtBRL(summary.totalInvestment)} />
        <Kpi label="Envios influencers" value={String(summary.totalShipments)} />
        <Kpi
          label="Em risco"
          value={fmtBRL(summary.wastedInvestment)}
          tone={summary.wastedInvestment > 0 ? "danger" : "ok"}
        />
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex gap-2 items-start">
        <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-snug">{insight}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Sem produtos com investimento de marketing no período.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-2">Produto</th>
                <th className="text-right px-2 py-2">Investido</th>
                <th className="text-right px-2 py-2">Envios</th>
                <th className="text-right px-2 py-2">FPY</th>
                <th className="text-right px-2 py-2">Ocorr.</th>
                <th className="text-right px-2 py-2">CoNQ</th>
                <th className="text-left px-2 py-2">Risco</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} className="border-t border-border/50">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Package className="size-3.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium leading-tight">{r.productName}</div>
                        {r.sku && (
                          <div className="text-[11px] text-muted-foreground font-mono">{r.sku}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(r.investment)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {r.shipments}
                    {r.influencers > 0 && (
                      <span className="text-[11px] text-muted-foreground"> / {r.influencers}</span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      r.fpyPct < 80 ? "text-destructive font-semibold" : ""
                    }`}
                  >
                    {r.fpyPct.toFixed(0)}%
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.occurrences}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(r.conqEstimate)}</td>
                  <td className="px-2 py-2">
                    <RiskBadge label={r.riskLabel} score={r.riskScore} reason={r.reason} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "ok"
        ? "text-emerald-500"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums mt-0.5 ${toneCls}`}>{value}</div>
    </div>
  );
}

function RiskBadge({
  label,
  score,
  reason,
}: {
  label: "ok" | "atencao" | "critico";
  score: number;
  reason: string;
}) {
  const cls =
    label === "critico"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : label === "atencao"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  const Icon = label === "critico" ? AlertTriangle : label === "atencao" ? TrendingDown : Lightbulb;
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}
      >
        <Icon className="size-3" />
        {label === "critico" ? "Crítico" : label === "atencao" ? "Atenção" : "OK"} · {score}
      </span>
      <div className="text-[11px] text-muted-foreground leading-tight">{reason}</div>
    </div>
  );
}
