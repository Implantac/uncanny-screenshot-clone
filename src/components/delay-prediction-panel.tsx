import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Brain, AlertTriangle, CheckCircle2, Clock, ArrowRight, Loader2 } from "lucide-react";
import { predictDelays } from "@/lib/delay-prediction.functions";

const RISK_STYLES = {
  high: { ring: "border-destructive/40 bg-destructive/5", chip: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle, label: "Alto risco" },
  medium: { ring: "border-amber-500/40 bg-amber-500/5", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: Clock, label: "Atenção" },
  low: { ring: "border-success/30 bg-success/5", chip: "bg-success/15 text-success border-success/30", icon: CheckCircle2, label: "No prazo" },
} as const;

export function DelayPredictionPanel({ limit = 8 }: { limit?: number }) {
  const fn = useServerFn(predictDelays);
  const { data, isLoading, error } = useQuery({
    queryKey: ["delay-prediction"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Calculando previsão de atrasos…
      </div>
    );
  }
  if (error) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Não foi possível gerar a previsão.</div>;
  }

  const items = (data?.items ?? []).slice(0, limit);
  const highCount = (data?.items ?? []).filter((i) => i.risk === "high").length;
  const mediumCount = (data?.items ?? []).filter((i) => i.risk === "medium").length;

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
          <Brain className="size-4" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">PCP Sênior · IA preditiva</div>
          <h3 className="font-semibold leading-tight">Previsão de atrasos por OP</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30">{highCount} alto</span>
          <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">{mediumCount} atenção</span>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="size-8 mx-auto mb-2 text-success" />
          Nenhuma OP ativa — ou todas dentro da janela esperada.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => {
            const s = RISK_STYLES[i.risk];
            const Icon = s.icon;
            return (
              <li key={i.orderId} className={`px-5 py-3 flex items-start gap-3 ${s.ring}`}>
                <Icon className={`size-4 mt-0.5 ${i.risk === "high" ? "text-destructive" : i.risk === "medium" ? "text-amber-600 dark:text-amber-400" : "text-success"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-medium">{i.code}</code>
                    {i.productName && <span className="text-sm text-muted-foreground truncate">· {i.productName}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${s.chip}`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{i.reason}</p>
                </div>
                <Link
                  to="/lote/$id"
                  params={{ id: i.orderId }}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  Ver <ArrowRight className="size-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {data?.avgPerStage && (
        <footer className="px-5 py-3 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium">Mediana histórica (h):</span>
          {Object.entries(data.avgPerStage)
            .filter(([k]) => !["entregue", "concluido"].includes(k))
            .map(([k, v]) => (
              <span key={k}>
                {k}: <span className="text-foreground">{v}h</span>
              </span>
            ))}
        </footer>
      )}
    </section>
  );
}
