import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, Ban, Activity } from "lucide-react";
import { getQualityIntelligence } from "@/lib/quality-intelligence.functions";

export function QualityIntelligencePanel() {
  const fn = useServerFn(getQualityIntelligence);
  const { data, isLoading } = useQuery({
    queryKey: ["quality-intelligence"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <div className="font-medium text-sm">Qualidade Inteligente</div>
        <span className="text-xs text-muted-foreground">
          — {data.totalOccurrences} ocorrências em {data.windowDays}d · {data.openOccurrences}{" "}
          abertas
        </span>
      </header>

      {data.topKinds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.topKinds.map((k) => (
            <span
              key={k.kind}
              className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 border border-border"
            >
              {k.kind} · {k.count}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Activity className="size-3.5" /> Fornecedores com recorrência
        </div>
        {data.suppliers.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Sem ocorrências vinculadas a fornecedores.
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.suppliers.map((s) => (
              <div
                key={s.supplierId}
                className={`text-xs rounded-md border p-2 ${s.blockSuggested ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.supplierName}</div>
                  {s.blockSuggested && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                      <Ban className="size-3" /> bloquear
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5">{s.reason}</div>
                {s.recurringKinds.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.recurringKinds.map((k) => (
                      <span key={k.kind} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50">
                        {k.kind}×{k.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
