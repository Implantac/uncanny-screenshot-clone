import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info as InfoIcon,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getGlobalTimeline,
  type TimelineEvent,
  type TimelineSource,
} from "@/lib/timeline-global.functions";

const SEV_ICON: Record<TimelineEvent["severity"], typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: ShieldAlert,
};

const SEV_TONE: Record<TimelineEvent["severity"], string> = {
  info: "text-muted-foreground",
  success: "text-emerald-500",
  warning: "text-amber-500",
  critical: "text-destructive",
};

const SOURCE_LABEL: Record<TimelineSource, string> = {
  audit: "Auditoria",
  stage: "Estágio",
  occurrence: "Ocorrência",
  inspection: "Qualidade",
  prototype: "Protótipo",
  marketing: "Marketing",
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export type TimelineFeedProps = {
  entityIds?: string[];
  sinceDays?: number;
  limit?: number;
  title?: string;
  emptyLabel?: string;
  showSearch?: boolean;
};

/**
 * Onda D — Timeline Global unificada.
 * Renderiza o feed cronológico de eventos filtrado por entidades relacionadas
 * (coleção, protótipo, produto, OP, etc). Reutiliza `getGlobalTimeline`.
 */
export function TimelineFeed({
  entityIds,
  sinceDays = 30,
  limit = 200,
  title = "Timeline unificada",
  emptyLabel = "Nenhum evento no período.",
  showSearch = true,
}: TimelineFeedProps) {
  const fn = useServerFn(getGlobalTimeline);
  const [search, setSearch] = useState("");
  const scoped = entityIds && entityIds.length > 0;

  const { data = [], isLoading } = useQuery({
    queryKey: ["timeline-feed", entityIds?.slice().sort(), sinceDays, limit],
    queryFn: () =>
      fn({
        data: {
          entity_ids: entityIds,
          since_days: sinceDays,
          limit,
        },
      }),
    enabled: !scoped || (entityIds?.length ?? 0) > 0,
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.subtitle ?? "").toLowerCase().includes(q) ||
        (e.actor ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="outline" className="text-[10px]">
            {isLoading ? "…" : filtered.length}
          </Badge>
        </div>
        {showSearch && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no histórico…"
            className="h-8 max-w-[220px] text-xs"
          />
        )}
      </div>

      {isLoading ? (
        <div className="p-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {filtered.map((e) => {
            const Icon = SEV_ICON[e.severity];
            return (
              <li key={e.id} className="flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <Icon className={`size-4 mt-0.5 shrink-0 ${SEV_TONE[e.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{e.title}</span>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wide">
                      {SOURCE_LABEL[e.source]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                      {relTime(e.ts)}
                    </span>
                  </div>
                  {e.subtitle && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {e.subtitle}
                    </div>
                  )}
                  {(e.actor || e.link) && (
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {e.actor && <span>por {e.actor}</span>}
                      {e.link && (
                        <Link
                          to={e.link}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Abrir <ExternalLink className="size-3" />
                        </Link>
                      )}
                    </div>
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
