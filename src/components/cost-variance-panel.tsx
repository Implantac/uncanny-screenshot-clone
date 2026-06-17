import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FileWarning, Scale } from "lucide-react";
import { listCostVariance, type CostVarianceRow } from "@/lib/cost-variance.functions";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function CostVariancePanel() {
  const fn = useServerFn(listCostVariance);
  const [days, setDays] = useState(180);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cost-variance", days],
    queryFn: () => fn({ data: { sinceDays: days } }),
  });

  const summary = useMemo(() => {
    const withSheet = rows.filter((r) => r.has_tech_sheet);
    const theoretical = withSheet.reduce((s, r) => s + r.theoretical_total, 0);
    const real = withSheet.reduce((s, r) => s + r.real_total, 0);
    const loss = withSheet.reduce((s, r) => s + r.real_loss, 0);
    const noSheet = rows.length - withSheet.length;
    const variancePct = theoretical > 0 ? ((real - theoretical) / theoretical) * 100 : 0;
    return { theoretical, real, loss, variancePct, noSheet, total: rows.length };
  }, [rows]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Scale className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Janela:</span>
        {[60, 90, 180, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full border text-xs ${days === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Custo teórico" value={fmt(summary.theoretical)} />
        <SummaryCard label="Custo real estimado" value={fmt(summary.real)} tone={summary.real > summary.theoretical ? "warning" : "success"} />
        <SummaryCard label="Variação" value={`${summary.variancePct >= 0 ? "+" : ""}${summary.variancePct.toFixed(1)}%`} tone={summary.variancePct > 5 ? "destructive" : summary.variancePct < -2 ? "success" : "default"} />
        <SummaryCard label="Perdas (refugo)" value={fmt(summary.loss)} tone={summary.loss > 0 ? "destructive" : "default"} />
      </div>

      {summary.noSheet > 0 && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
          <FileWarning className="size-3.5" />
          {summary.noSheet} de {summary.total} OPs sem ficha técnica aprovada — custos teóricos zerados nestas linhas.
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">OP</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2">Qtd</th>
                <th className="text-right px-3 py-2">Teórico</th>
                <th className="text-right px-3 py-2">Real</th>
                <th className="text-right px-3 py-2">Perda</th>
                <th className="text-right px-3 py-2">Δ</th>
                <th className="text-right px-3 py-2">Δ%</th>
                <th className="text-left px-3 py-2">Sinais</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && sorted.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Sem OPs na janela.</td></tr>}
              {sorted.slice(0, 150).map((r) => <Row key={r.order_id} r={r} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ r }: { r: CostVarianceRow }) {
  const danger = r.variance_pct > 5;
  const good = r.variance_pct < -2;
  return (
    <tr className="border-t border-border hover:bg-muted/30">
      <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
      <td className="px-3 py-2 truncate max-w-[220px]">
        {r.product_name ?? <span className="text-muted-foreground">(sem produto)</span>}
        <div className="text-[10px] text-muted-foreground">{r.product_sku ?? "—"} · {r.stage}</div>
      </td>
      <td className="px-3 py-2 text-right">{r.quantity}</td>
      <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.theoretical_total)}</td>
      <td className="px-3 py-2 text-right font-medium">{fmt(r.real_total)}</td>
      <td className={`px-3 py-2 text-right ${r.real_loss > 0 ? "text-destructive" : "text-muted-foreground"}`}>{fmt(r.real_loss)}</td>
      <td className={`px-3 py-2 text-right font-semibold ${danger ? "text-destructive" : good ? "text-success" : ""}`}>{fmt(r.variance)}</td>
      <td className={`px-3 py-2 text-right ${danger ? "text-destructive" : good ? "text-success" : "text-muted-foreground"}`}>
        {r.variance_pct >= 0 ? "+" : ""}{r.variance_pct.toFixed(1)}%
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1 text-[10px]">
          {!r.has_tech_sheet && <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning">sem ficha</span>}
          {!r.has_real_consumption && r.has_tech_sheet && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">sem consumo</span>}
          {r.occurrences.refugo > 0 && <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive flex items-center gap-1"><AlertTriangle className="size-2.5" />refugo {r.occurrences.refugo}</span>}
          {r.occurrences.retrabalho > 0 && <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning">retrab. {r.occurrences.retrabalho}</span>}
          {r.has_tech_sheet && r.has_real_consumption && r.occurrences.total === 0 && Math.abs(r.variance_pct) <= 2 && (
            <span className="px-1.5 py-0.5 rounded bg-success/15 text-success flex items-center gap-1"><CheckCircle2 className="size-2.5" />no alvo</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "destructive" }) {
  const tones = {
    default: "",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}
