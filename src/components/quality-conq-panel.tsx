import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DollarSign, TrendingDown, AlertTriangle } from "lucide-react";
import { getConqAnalysis } from "@/lib/quality-conq.functions";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function QualityConqPanel() {
  const fetchConq = useServerFn(getConqAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["quality-conq"],
    queryFn: () => fetchConq(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5">
        <p className="text-sm text-muted-foreground">Calculando CoNQ…</p>
      </div>
    );
  }
  if (!data) return null;

  const pctColor =
    data.conqPct > 5
      ? "text-red-500"
      : data.conqPct > 3
        ? "text-amber-500"
        : "text-emerald-500";

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <DollarSign className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Custo da Não-Qualidade (CoNQ)</h2>
            <p className="text-xs text-muted-foreground">
              Janela de {data.windowDays} dias · retrabalho + refugo + rejeição
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${pctColor}`}>{data.conqPct.toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground">da produção</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Card label="Retrabalho" value={fmtBRL(data.reworkCost)} />
        <Card label="Refugo" value={fmtBRL(data.scrapCost)} />
        <Card label="Rejeição QC" value={fmtBRL(data.rejectCost)} />
        <Card label="Total CoNQ" value={fmtBRL(data.totalConq)} highlight />
      </div>

      <div className="rounded-xl bg-muted/30 border border-border p-3 flex items-start gap-2 text-xs">
        <TrendingDown className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-snug">{data.insight}</p>
      </div>

      {data.topOffenders.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle className="size-3" /> Top ofensores
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1.5 pr-2">Produto</th>
                  <th className="py-1.5 px-2 text-right">Retrab.</th>
                  <th className="py-1.5 px-2 text-right">Refugo</th>
                  <th className="py-1.5 px-2 text-right">Rej.</th>
                  <th className="py-1.5 pl-2 text-right">CoNQ</th>
                </tr>
              </thead>
              <tbody>
                {data.topOffenders.map((r) => (
                  <tr key={r.productId} className="border-t border-border/40">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium truncate max-w-[200px]">{r.productName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.sku}</div>
                    </td>
                    <td className="py-1.5 px-2 text-right">{r.reworkQty}</td>
                    <td className="py-1.5 px-2 text-right">{r.scrapQty}</td>
                    <td className="py-1.5 px-2 text-right">{r.rejectQty}</td>
                    <td className="py-1.5 pl-2 text-right font-semibold">
                      {fmtBRL(r.totalConq)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
