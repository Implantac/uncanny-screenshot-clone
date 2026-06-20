import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Layers, Lightbulb, TrendingDown, TrendingUp, AlertOctagon } from "lucide-react";
import { getCollectionsBridgeAnalysis } from "@/lib/quality-collections-bridge.functions";

function fmtPct(n: number) {
  return `${n.toFixed(0)}%`;
}
function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const RISK_STYLE: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  atencao: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  critico: "bg-rose-500/10 text-rose-500 border-rose-500/30",
};

export function QualityCollectionsBridgePanel() {
  const fn = useServerFn(getCollectionsBridgeAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["quality-collections-bridge"],
    queryFn: () => fn(),
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6 animate-pulse">
        <div className="h-5 w-48 bg-muted/40 rounded mb-3" />
        <div className="h-32 bg-muted/20 rounded" />
      </div>
    );
  }
  if (!data) return null;

  const visible = data.rows.filter(
    (r) => r.ordersTotal + r.inspectionsTotal + r.occurrences > 0,
  );

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border bg-[image:var(--gradient-subtle)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <Layers className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">Qualidade × Coleções</h3>
            <p className="text-xs text-muted-foreground">
              Saúde de qualidade agregada por coleção — FPY, on-time, CoNQ, FTR
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Coleções" value={String(data.summary.collections)} />
          <Kpi
            label="Críticas"
            value={String(data.summary.criticos)}
            tone={data.summary.criticos > 0 ? "bad" : "good"}
          />
          <Kpi
            label="FPY médio"
            value={fmtPct(data.summary.avgFpy)}
            tone={data.summary.avgFpy >= 85 ? "good" : data.summary.avgFpy >= 70 ? "warn" : "bad"}
          />
          <Kpi
            label="CoNQ total"
            value={fmtMoney(data.summary.totalConq)}
            tone={data.summary.totalConq > 0 ? "warn" : "good"}
          />
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
          <Lightbulb className="size-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{data.insight}</p>
        </div>

        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sem coleções com produção/inspeção ativa no período.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2">Coleção</th>
                  <th className="text-center px-2 py-2">Produtos</th>
                  <th className="text-center px-2 py-2">FPY</th>
                  <th className="text-center px-2 py-2">On-time</th>
                  <th className="text-center px-2 py-2">FTR</th>
                  <th className="text-center px-2 py-2">Ocorr.</th>
                  <th className="text-right px-2 py-2">CoNQ</th>
                  <th className="text-center px-2 py-2">Risco</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-2 py-2.5">
                      <Link
                        to="/colecoes/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {[r.season, r.year].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="text-center px-2 py-2.5 tabular-nums">{r.products}</td>
                    <td className="text-center px-2 py-2.5 tabular-nums">
                      <span
                        className={
                          r.fpyPct >= 85
                            ? "text-emerald-500"
                            : r.fpyPct >= 70
                              ? "text-amber-500"
                              : "text-rose-500"
                        }
                      >
                        {r.inspectionsTotal ? fmtPct(r.fpyPct) : "—"}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2.5 tabular-nums">
                      <span
                        className={
                          r.onTimePct >= 90
                            ? "text-emerald-500"
                            : r.onTimePct >= 75
                              ? "text-amber-500"
                              : "text-rose-500"
                        }
                      >
                        {r.ordersTotal ? fmtPct(r.onTimePct) : "—"}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2.5 tabular-nums text-muted-foreground">
                      {fmtPct(r.ftrPct)}
                    </td>
                    <td className="text-center px-2 py-2.5 tabular-nums">
                      {r.occurrences > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <AlertOctagon className="size-3" />
                          {r.occurrences}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums">
                      {r.conqEstimate > 0 ? fmtMoney(r.conqEstimate) : "—"}
                    </td>
                    <td className="text-center px-2 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${RISK_STYLE[r.riskLabel]}`}
                      >
                        {r.riskLabel === "critico" ? (
                          <TrendingDown className="size-3" />
                        ) : r.riskLabel === "ok" ? (
                          <TrendingUp className="size-3" />
                        ) : null}
                        {r.riskScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "bad"
          ? "text-rose-500"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
