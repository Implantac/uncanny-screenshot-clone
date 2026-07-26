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
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  getAlertsCenter,
  dismissAlert,
  dispatchAlertPushes,
  type AlertSeverity,
  type AlertCategory,
  type CenterAlert,
  type DismissMode,
} from "@/lib/alerts-center.functions";

import { PageHeader } from "@/components/ui/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const SNOOZE_OPTIONS: { mode: DismissMode; label: string }[] = [
  { mode: "snooze_1h", label: "Adiar 1 hora" },
  { mode: "snooze_1d", label: "Adiar 1 dia" },
  { mode: "snooze_7d", label: "Adiar 7 dias" },
];

function AlertsCenterPage() {
  const qc = useQueryClient();
  const fetchAlerts = useServerFn(getAlertsCenter);
  const dismissFn = useServerFn(dismissAlert);
  const dispatchFn = useServerFn(dispatchAlertPushes);
  const { data, isLoading } = useQuery({
    queryKey: ["alerts-center"],
    queryFn: async () => {
      const alerts = await fetchAlerts();
      // fire-and-forget push dispatch (dedupe 24h no servidor)
      dispatchFn().catch(() => {});
      return alerts;
    },
    refetchInterval: 60_000,
  });


  const [cat, setCat] = useState<AlertCategory | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const dismiss = useMutation({
    mutationFn: (v: { keys: string[]; mode: DismissMode }) => dismissFn({ data: v }),
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

  // Group by severity → then by entity (fallback: individual key)
  const grouped: Record<AlertSeverity, { entityKey: string; label?: string; items: CenterAlert[] }[]> =
    useMemo(() => {
      const bySev: Record<AlertSeverity, Map<string, { label?: string; items: CenterAlert[] }>> = {
        critica: new Map(),
        alta: new Map(),
        media: new Map(),
        baixa: new Map(),
      };
      for (const a of filtered) {
        const gk = a.entityKey ?? a.key;
        const bucket = bySev[a.severity];
        if (!bucket.has(gk)) bucket.set(gk, { label: a.entityLabel, items: [] });
        bucket.get(gk)!.items.push(a);
      }
      const out = {} as Record<
        AlertSeverity,
        { entityKey: string; label?: string; items: CenterAlert[] }[]
      >;
      (Object.keys(bySev) as AlertSeverity[]).forEach((s) => {
        out[s] = Array.from(bySev[s], ([entityKey, v]) => ({ entityKey, ...v }));
      });
      return out;
    }, [filtered]);

  const total = filtered.length;

  const renderCard = (a: CenterAlert, compact = false) => {
    const Icon = CAT_ICON[a.category];
    return (
      <article
        key={a.key}
        className={`group border border-border border-l-4 rounded-md p-3 ${
          compact ? "" : SEV_STYLE[a.severity]
        }`}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Adiar"
                  aria-label="Adiar alerta"
                  className="size-7 grid place-items-center rounded hover:bg-background"
                >
                  <BellOff className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SNOOZE_OPTIONS.map((o) => (
                  <DropdownMenuItem
                    key={o.mode}
                    onClick={() => dismiss.mutate({ keys: [a.key], mode: o.mode })}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              title="Marcar resolvido"
              aria-label="Marcar resolvido"
              onClick={() => dismiss.mutate({ keys: [a.key], mode: "resolve" })}
              className="size-7 grid place-items-center rounded hover:bg-background"
            >
              <Check className="size-3.5 text-success" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Prioridades do dia"
        title={
          <span className="inline-flex items-center gap-2">
            <Inbox className="size-6 text-primary" /> Central de Alertas
          </span>
        }
        description="Tudo o que precisa da sua atenção em um só lugar — priorizado por impacto, agrupado por OP/produto."
        actions={
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums leading-none">
              {data?.length ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">alertas ativos</div>
          </div>
        }
      />

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

      {(["critica", "alta", "media", "baixa"] as AlertSeverity[]).map((sev) => {
        const groups = grouped[sev];
        if (!groups || groups.length === 0) return null;
        const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
        return (
          <section key={sev} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SEV_LABEL[sev]} · {totalItems}
            </h2>
            <div className="space-y-2">
              {groups.map((g) => {
                if (g.items.length === 1) return renderCard(g.items[0]);
                const isOpen = expanded[g.entityKey] ?? false;
                const allKeys = g.items.map((i) => i.key);
                return (
                  <div
                    key={g.entityKey}
                    className={`border border-border border-l-4 rounded-md ${SEV_STYLE[sev]}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [g.entityKey]: !isOpen }))
                      }
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-background/40"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                      <Layers className="size-4 text-foreground/70" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {g.label ?? "Grupo"}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {g.items.length} alertas
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {g.items.map((i) => i.title).join(" · ")}
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className="text-xs px-2 py-1 rounded bg-background border border-border hover:bg-muted inline-flex items-center gap-1">
                              <BellOff className="size-3" /> Adiar grupo
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {SNOOZE_OPTIONS.map((o) => (
                              <DropdownMenuItem
                                key={o.mode}
                                onClick={() =>
                                  dismiss.mutate({ keys: allKeys, mode: o.mode })
                                }
                              >
                                {o.label} ({g.items.length})
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          type="button"
                          title="Resolver grupo"
                          aria-label="Resolver grupo"
                          onClick={() =>
                            dismiss.mutate({ keys: allKeys, mode: "resolve" })
                          }
                          className="size-7 grid place-items-center rounded hover:bg-background"
                        >
                          <Check className="size-3.5 text-success" />
                        </button>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="p-3 pt-0 space-y-2 border-t border-border/60">
                        {g.items.map((a) => renderCard(a, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
