import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Info,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  getPersonaInsights,
  type PersonaInsight,
  type PersonaKey,
} from "@/lib/ai-persona-insights.functions";
import { Badge } from "@/components/ui/badge";

const SEV: Record<
  PersonaInsight["severity"],
  { tone: string; Icon: typeof Info; label: string }
> = {
  info: {
    tone: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    Icon: Info,
    label: "Info",
  },
  warn: {
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    Icon: AlertTriangle,
    label: "Atenção",
  },
  critical: {
    tone: "bg-red-500/10 text-red-700 border-red-500/30",
    Icon: AlertCircle,
    label: "Crítico",
  },
};

const TITLE: Record<PersonaKey, string> = {
  "coord-dev": "IA · Coordenador de Desenvolvimento",
  pcp: "IA · PCP Sênior",
  marketing: "IA · Marketing Intelligence",
  qualidade: "IA · Qualidade Sênior",
};

export function PersonaInsightsPanel({ persona }: { persona: PersonaKey }) {
  const qc = useQueryClient();
  const fn = useServerFn(getPersonaInsights);
  const { data, isFetching, error } = useQuery({
    queryKey: ["persona-insights", persona],
    queryFn: () => fn({ data: { persona } }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <div className="text-sm font-semibold">{TITLE[persona]}</div>
        <span className="text-[11px] text-muted-foreground">
          sinais cruzados — explica o porquê
        </span>
        <button
          onClick={() =>
            qc.invalidateQueries({ queryKey: ["persona-insights", persona] })
          }
          disabled={isFetching}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Atualizar"
        >
          {isFetching ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
        </button>
      </div>

      {error ? (
        <div className="text-xs text-destructive">
          Falha: {(error as Error).message}
        </div>
      ) : data?.error === "rate_limited" ? (
        <div className="text-xs text-amber-600">
          Muitas chamadas — aguarde alguns segundos e atualize.
        </div>
      ) : data?.error === "credits_exhausted" ? (
        <div className="text-xs text-amber-600">
          Créditos de IA esgotados — adicione créditos no workspace.
        </div>
      ) : !data || isFetching ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Cruzando indicadores…
        </div>
      ) : data.items.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Sem sinais relevantes no momento. Tudo dentro do esperado.
        </div>
      ) : (
        <ol className="space-y-2">
          {data.items.map((it, i) => {
            const s = SEV[it.severity];
            return (
              <li
                key={i}
                className={`rounded-lg border p-3 ${s.tone}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <s.Icon className="size-3.5" />
                  <div className="text-sm font-semibold">{it.signal}</div>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {s.label}
                  </Badge>
                </div>
                <div className="text-[11px] font-mono opacity-80 mb-1">
                  {it.evidence}
                </div>
                <div className="text-xs mb-2 opacity-90">{it.why}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">→ {it.nextAction}</span>
                  {it.link && (
                    <Link
                      to={it.link}
                      className="inline-flex items-center gap-1 text-[11px] underline opacity-80 hover:opacity-100"
                    >
                      fazer agora <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
