import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Factory, AlertTriangle, Clock, Package, TrendingDown, MapPin } from "lucide-react";
import { getFaccoes360 } from "@/lib/facao-360.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/faccoes")({
  component: FaccoesPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado</div>,
});

function FaccoesPage() {
  const run = useServerFn(getFaccoes360);
  const { data, isLoading } = useQuery({
    queryKey: ["faccoes-360"],
    queryFn: () => run(),
    staleTime: 60_000,
  });

  const items = data ?? [];

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Factory className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Facção 360°</h1>
          <p className="text-sm text-muted-foreground">
            Painel consolidado das oficinas externas — perda, defeito, lead time real e OS atrasadas
            (90 dias).
          </p>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando facções…</p>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Factory className="size-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nenhuma OS externa nos últimos 90 dias</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie uma Ordem de Serviço em Acompanhamento de Produção para começar a medir suas
            facções.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((f) => (
            <article key={f.supplierId} className="glass rounded-2xl p-4 space-y-3">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm">{f.name}</h3>
                  {(f.city || f.state) && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3" />
                      {[f.city, f.state].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {f.overdue > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="size-3 mr-1" />
                    {f.overdue} atrasada(s)
                  </Badge>
                )}
              </header>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Kpi label="OS abertas" value={f.openOS} sub={`${f.inTransit} em trânsito`} />
                <Kpi
                  label="Enviado / Recebido"
                  value={`${f.qtySent.toFixed(0)} / ${f.qtyReceived.toFixed(0)}`}
                />
                <Kpi
                  label="Perda"
                  value={`${f.lossPct}%`}
                  tone={f.lossPct > 3 ? "warn" : "ok"}
                  icon={<TrendingDown className="size-3" />}
                />
                <Kpi
                  label="Defeito"
                  value={`${f.defectPct}%`}
                  tone={f.defectPct > 5 ? "warn" : "ok"}
                  icon={<Package className="size-3" />}
                />
                <Kpi
                  label="Lead time médio"
                  value={f.avgLeadTimeDays !== null ? `${f.avgLeadTimeDays}d` : "—"}
                  tone={
                    f.avgLeadTimeDays !== null && f.avgLeadTimeDays > 21 ? "warn" : "ok"
                  }
                  icon={<Clock className="size-3" />}
                />
                <Kpi label="Total OS (90d)" value={f.totalOS} />
              </div>

              <div className="rounded-md bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground border border-border/50">
                <span className="font-medium text-foreground">IA: </span>
                {f.reason}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "warn";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "warn"
      ? "text-amber-600"
      : tone === "ok"
        ? "text-foreground"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/10 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
