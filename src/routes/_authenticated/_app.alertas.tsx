import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Clock,
  Pause,
  ShieldAlert,
  Sparkles,
  Megaphone,
  Check,
  BellOff,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  getAlertsCenter,
  dismissAlert,
  type AlertSeverity,
  type AlertCategory,
  type CenterAlert,
} from "@/lib/alerts-center.functions";

export const Route = createFileRoute("/_authenticated/_app/alertas")({
  component: AlertsCenterPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-sm text-destructive">
      Erro ao carregar alertas: {error.message}
      <button onClick={() => reset()} className="ml-2 underline">
        tentar novamente
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Página não encontrada.</div>,
});

const CAT_LABEL: Record<AlertCategory | "all", string> = {
  all: "Tudo",
  estoque: "Estoque",
  atraso: "Atrasos",
  parado: "Parados",
  qualidade: "Qualidade",
  proto: "Protótipos",
  marketing: "Marketing",
};

const SEV_LABEL: Record<AlertSeverity, string> = {
  critica: "Críticos — agir agora",
  alta: "Altos — agir hoje",
  media: "Médios — esta semana",
  baixa: "Baixos — acompanhar",
};

const SEV_STYLE: Record<AlertSeverity, string> = {
  critica: "border-l-destructive bg-destructive/5",
  alta: "border-l-warning bg-warning/5",
  media: "border-l-primary bg-primary/5",
  baixa: "border-l-muted-foreground bg-muted/30",
};

const CAT_ICON: Record<AlertCategory, React.ComponentType<{ className?: string }>> = {
  estoque: AlertTriangle,
  atraso: Clock,
  parado: Pause,
  qualidade: ShieldAlert,
  proto: Sparkles,
  marketing: Megaphone,
};

function AlertsCenterPage() {
  const qc = useQueryClient();
  const fetchAlerts = useServerFn(getAlertsCenter);
  const dismissFn = useServerFn(dismissAlert);
  const { data, isLoading } = useQuery({
    queryKey: ["alerts-center"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60_000,
  });

  const [cat, setCat] = useState<AlertCategory | "all">("all");

  const dismiss = useMutation({
    mutationFn: (v: { key: string; mode: "snooze" | "resolve" }) =>
      dismissFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-center"] }),
  });

  const filtered = useMemo<CenterAlert[]>(
    () => (data ?? []).filter((a) => cat === "all" || a.category === cat),
    [data, cat],
  );

  const counts: Record<AlertCategory | "all", number> = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const a of data ?? []) c[a.category] = (c[a.category] ?? 0) + 1;
    return c as Record<AlertCategory | "all", number>;
  }, [data]);

  const grouped: Record<AlertSeverity, CenterAlert[]> = useMemo(() => {
    const g: Record<AlertSeverity, CenterAlert[]> = {
      critica: [],
      alta: [],
      media: [],
      baixa: [],
    };
    for (const a of filtered) g[a.severity].push(a);
    return g;
  }, [filtered]);

  const total = filtered.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Inbox className="size-6 text-primary" />
            Central de Alertas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tudo o que precisa da sua atenção em um só lugar — priorizado por impacto.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">{data?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground">alertas ativos</div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(CAT_LABEL) as (AlertCategory | "all")[]).map((k) => (
          <button
            key={k}
            onClick={() => setCat(k)}
            className={`text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-colors ${
              cat === k
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/70 text-muted-foreground"
            }`}
          >
            {CAT_LABEL[k]}
            {(counts[k] ?? 0) > 0 && (
              <span className="tabular-nums opacity-80">{counts[k]}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Carregando alertas…</div>
      )}

      {!isLoading && total === 0 && (
        <div className="border border-border rounded-lg p-12 text-center">
          <CheckCircle2 className="size-12 text-success mx-auto mb-3" />
          <div className="text-base font-medium">Tudo sob controle</div>
          <div className="text-sm text-muted-foreground mt-1">
            Nenhum alerta {cat === "all" ? "ativo" : `em ${CAT_LABEL[cat]}`} no momento.
          </div>
        </div>
      )}

      {(["critica", "alta", "media", "baixa"] as AlertSeverity[]).map((sev) =>
        grouped[sev].length === 0 ? null : (
          <section key={sev} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SEV_LABEL[sev]} · {grouped[sev].length}
            </h2>
            <div className="space-y-2">
              {grouped[sev].map((a) => {
                const Icon = CAT_ICON[a.category];
                return (
                  <article
                    key={a.key}
                    className={`group border border-border border-l-4 rounded-md p-3 ${SEV_STYLE[a.severity]}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="size-4 mt-0.5 shrink-0 text-foreground/70" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <div className="text-sm font-medium">{a.title}</div>
                          <div className="text-xs text-muted-foreground">{a.detail}</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 italic">{a.why}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          to={a.link}
                          className="text-xs px-2 py-1 rounded bg-background border border-border hover:bg-muted"
                        >
                          Ir para
                        </Link>
                        <button
                          type="button"
                          title="Adiar 7 dias"
                          onClick={() => dismiss.mutate({ key: a.key, mode: "snooze" })}
                          className="size-7 grid place-items-center rounded hover:bg-background"
                        >
                          <BellOff className="size-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          title="Marcar resolvido"
                          onClick={() => dismiss.mutate({ key: a.key, mode: "resolve" })}
                          className="size-7 grid place-items-center rounded hover:bg-background"
                        >
                          <Check className="size-3.5 text-success" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
