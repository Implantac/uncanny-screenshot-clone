import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertCircle, ShieldPlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getFpyAnalysis, createPreventiveCapa } from "@/lib/quality-fpy.functions";

export function QualityFpyPanel() {
  const qc = useQueryClient();
  const fetchFpy = useServerFn(getFpyAnalysis);
  const createCapa = useServerFn(createPreventiveCapa);

  const { data, isLoading } = useQuery({
    queryKey: ["quality-fpy"],
    queryFn: () => fetchFpy({}),
    staleTime: 60_000,
  });

  const mCapa = useMutation({
    mutationFn: (vars: { supplierId: string; inspectionType: string; suggestion: string }) =>
      createCapa({ data: vars }),
    onSuccess: (res) => {
      if (res.alreadyExists) toast.info("CAPA preventiva já existe para este padrão");
      else toast.success("CAPA preventiva criada");
      qc.invalidateQueries({ queryKey: ["quality-fpy"] });
      qc.invalidateQueries({ queryKey: ["capa-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return null;

  const fpyColor =
    data.globalFpy >= 95
      ? "text-emerald-500"
      : data.globalFpy >= 85
        ? "text-amber-500"
        : "text-destructive";

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <div className="font-medium text-sm">FPY — First Pass Yield</div>
          <span className="text-xs text-muted-foreground">
            · {data.totalInspections} inspeções em {data.windowDays}d
          </span>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold tabular-nums ${fpyColor}`}>
            {data.globalFpy.toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">global</div>
        </div>
      </header>

      {data.bySupplier.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sem inspeções no período.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="py-1.5">Fornecedor</th>
                <th className="text-right">Insp.</th>
                <th className="text-right">Aprov.</th>
                <th className="text-right">Repr.</th>
                <th className="text-right">Críticos</th>
                <th className="text-right">FPY</th>
              </tr>
            </thead>
            <tbody>
              {data.bySupplier.slice(0, 8).map((s) => {
                const cls =
                  s.status === "verde"
                    ? "text-emerald-500"
                    : s.status === "amarelo"
                      ? "text-amber-500"
                      : "text-destructive";
                return (
                  <tr key={s.supplierId} className="border-b border-border/40">
                    <td className="py-1.5 truncate max-w-[14rem]">{s.supplierName}</td>
                    <td className="text-right tabular-nums">{s.total}</td>
                    <td className="text-right tabular-nums text-emerald-500">{s.approved}</td>
                    <td className="text-right tabular-nums text-destructive">{s.rejected}</td>
                    <td className="text-right tabular-nums">{s.criticalDefects}</td>
                    <td className={`text-right tabular-nums font-medium ${cls}`}>
                      {s.fpy.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.recurrences.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="size-3.5 text-amber-500" /> Padrões recorrentes detectados —
            sugestão de CAPA preventiva
          </div>
          <div className="space-y-1.5">
            {data.recurrences.map((r) => (
              <div
                key={r.key}
                className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-medium">{r.supplierName}</span>
                    <span className="text-muted-foreground"> · {r.inspectionType}</span>
                    <span className="ml-2 text-destructive font-medium">
                      {r.occurrences} reprovações
                    </span>
                  </div>
                  {r.hasPreventive ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500 text-[10px]">
                      <CheckCircle2 className="size-3" /> CAPA ativa
                    </span>
                  ) : r.supplierId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] gap-1"
                      disabled={mCapa.isPending}
                      onClick={() =>
                        mCapa.mutate({
                          supplierId: r.supplierId!,
                          inspectionType: r.inspectionType,
                          suggestion: r.suggestedPreventive,
                        })
                      }
                    >
                      <ShieldPlus className="size-3" /> Criar CAPA preventiva
                    </Button>
                  ) : null}
                </div>
                <div className="mt-1 text-muted-foreground leading-snug">
                  {r.suggestedPreventive}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
