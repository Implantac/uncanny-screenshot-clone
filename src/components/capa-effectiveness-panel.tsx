import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCAPAEffectiveness } from "@/lib/capa-effectiveness.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertCircle, Clock, TrendingUp } from "lucide-react";

const fmtPct = (n: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n)}%`;

export function CapaEffectivenessPanel() {
  const fetchFn = useServerFn(getCAPAEffectiveness);
  const { data, isLoading, error } = useQuery({
    queryKey: ["capa-effectiveness"],
    queryFn: () => fetchFn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          Efetividade de CAPA · janela de {data?.window_days ?? 60} dias
        </CardTitle>
        <CardDescription>
          Mede quantas CAPAs fechadas <strong>não tiveram reincidência</strong> do mesmo fornecedor nos {data?.window_days ?? 60} dias seguintes.
          Métrica gerencial — não burocrática.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div className="text-sm text-muted-foreground">Cruzando CAPAs fechadas × inspeções pós-fechamento...</div>}
        {error && <div className="text-sm text-destructive">Erro: {(error as Error).message}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat icon={<TrendingUp className="size-3.5" />} label="Efetividade" value={fmtPct(data.efetividade_pct)} tone={data.efetividade_pct >= 80 ? "ok" : data.efetividade_pct >= 60 ? "warn" : "danger"} />
              <Stat icon={<ShieldCheck className="size-3.5" />} label="Efetivas" value={String(data.efetivas)} />
              <Stat icon={<AlertCircle className="size-3.5" />} label="Reincidentes" value={String(data.reincidentes)} tone={data.reincidentes > 0 ? "danger" : "ok"} />
              <Stat icon={<Clock className="size-3.5" />} label="Em verificação" value={String(data.em_verificacao)} />
            </div>

            {data.por_fornecedor.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pior efetividade por fornecedor</div>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-2">Fornecedor</th>
                        <th className="p-2 text-right">CAPAs avaliadas</th>
                        <th className="p-2 text-right">Reincidentes</th>
                        <th className="p-2 text-right">Efetividade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.por_fornecedor.slice(0, 8).map((s) => (
                        <tr key={s.supplier_id} className="border-t">
                          <td className="p-2 font-medium">{s.supplier_name}</td>
                          <td className="p-2 text-right tabular-nums">{s.total}</td>
                          <td className={`p-2 text-right tabular-nums ${s.reincidentes > 0 ? "text-destructive font-semibold" : ""}`}>{s.reincidentes}</td>
                          <td className="p-2 text-right tabular-nums">
                            <Badge variant={s.efetividade_pct >= 80 ? "outline" : "destructive"}>{fmtPct(s.efetividade_pct)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.rows.filter((r) => r.status_efetividade === "reincidente").length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CAPAs reincidentes (ação imediata)</div>
                <div className="space-y-1">
                  {data.rows
                    .filter((r) => r.status_efetividade === "reincidente")
                    .slice(0, 5)
                    .map((r) => (
                      <div key={r.capa_id} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                        <div className="font-medium">{r.title}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {r.supplier_name ?? "—"} · {r.reincidencias} reincidência(s) após fechamento em{" "}
                          {new Date(r.closed_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {data.total_fechadas === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Nenhuma CAPA fechada nos últimos 120 dias.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "";
  return (
    <div className={`rounded-md border p-2.5 ${cls}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
