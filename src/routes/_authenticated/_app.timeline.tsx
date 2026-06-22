import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Factory,
  History,
  Loader2,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  getGlobalTimeline,
  type TimelineEvent,
  type TimelineSource,
} from "@/lib/timeline-global.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/_app/timeline")({
  component: TimelinePage,
});

const SOURCE_META: Record<TimelineSource, { label: string; icon: typeof Activity; tint: string }> = {
  audit: { label: "Auditoria", icon: ShieldCheck, tint: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  stage: { label: "Estágio", icon: Factory, tint: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  occurrence: { label: "Ocorrência", icon: AlertTriangle, tint: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  inspection: { label: "Qualidade", icon: ClipboardCheck, tint: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  prototype: { label: "Protótipo", icon: Sparkles, tint: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30" },
  marketing: { label: "Marketing", icon: Megaphone, tint: "bg-pink-500/10 text-pink-600 border-pink-500/30" },
};

const SEV_TINT: Record<TimelineEvent["severity"], string> = {
  info: "bg-muted/40 text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

function TimelinePage() {
  const fn = useServerFn(getGlobalTimeline);
  const [sources, setSources] = useState<TimelineSource[]>([]);
  const [sinceDays, setSinceDays] = useState(14);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<TimelineEvent["severity"] | "all">("all");

  const q = useQuery({
    queryKey: ["timeline-global", sources, sinceDays, search, severity],
    queryFn: () =>
      fn({
        data: {
          sources: sources.length ? sources : undefined,
          since_days: sinceDays,
          search: search.trim() || undefined,
          severity: severity === "all" ? undefined : [severity],
          limit: 250,
        },
      }) as Promise<TimelineEvent[]>,
    refetchInterval: 30_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of q.data ?? []) {
      const day = new Date(e.ts).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [q.data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: q.data?.length ?? 0 };
    for (const e of q.data ?? []) c[e.severity] = (c[e.severity] ?? 0) + 1;
    return c;
  }, [q.data]);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-6xl mx-auto">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Timeline Global</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Tudo o que aconteceu — auditoria, estágios, ocorrências, qualidade,
          protótipos e marketing — em um único feed cronológico.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por texto, ator, código…"
            className="pl-7 h-9"
          />
        </div>
        <Select value={String(sinceDays)} onValueChange={(v) => setSinceDays(Number(v))}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24h</SelectItem>
            <SelectItem value="7">Últimos 7d</SelectItem>
            <SelectItem value="14">Últimos 14d</SelectItem>
            <SelectItem value="30">Últimos 30d</SelectItem>
            <SelectItem value="90">Últimos 90d</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Atenção</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSources([]);
            setSearch("");
            setSeverity("all");
          }}
        >
          Limpar
        </Button>
      </div>

      <ToggleGroup
        type="multiple"
        value={sources}
        onValueChange={(v) => setSources(v as TimelineSource[])}
        className="flex flex-wrap justify-start gap-1"
      >
        {(Object.keys(SOURCE_META) as TimelineSource[]).map((src) => {
          const meta = SOURCE_META[src];
          const Icon = meta.icon;
          return (
            <ToggleGroupItem key={src} value={src} className="h-8 gap-1.5 text-xs data-[state=on]:bg-primary/10">
              <Icon className="size-3.5" />
              {meta.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{counts.all ?? 0} eventos</span>
        {counts.critical ? <Badge variant="outline" className={SEV_TINT.critical}>{counts.critical} crítico</Badge> : null}
        {counts.warning ? <Badge variant="outline" className={SEV_TINT.warning}>{counts.warning} atenção</Badge> : null}
        {counts.success ? <Badge variant="outline" className={SEV_TINT.success}>{counts.success} sucesso</Badge> : null}
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
          <Loader2 className="size-4 animate-spin" /> Coletando eventos…
        </div>
      ) : !grouped.length ? (
        <div className="text-sm text-muted-foreground p-8 text-center border border-dashed rounded-xl">
          Nenhum evento no período/filtros selecionados.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, events]) => (
            <section key={day}>
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur py-1.5 mb-2 -mx-1 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground first-letter:uppercase">
                  {day}
                </h2>
              </div>
              <ol className="space-y-1.5">
                {events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const meta = SOURCE_META[event.source];
  const Icon = meta.icon;
  const time = new Date(event.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const SevIcon =
    event.severity === "critical" ? AlertTriangle :
    event.severity === "warning" ? AlertTriangle :
    event.severity === "success" ? CheckCircle2 : Activity;

  const content = (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent/30 transition group">
      <div className={`grid size-8 place-items-center rounded-md border ${meta.tint} shrink-0`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{event.title}</span>
          <Badge variant="outline" className={`text-[10px] ${SEV_TINT[event.severity]}`}>
            <SevIcon className="size-2.5 mr-0.5" />
            {event.severity}
          </Badge>
          {event.actor && (
            <span className="text-[10px] text-muted-foreground truncate">por {event.actor}</span>
          )}
        </div>
        {event.subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono">{time}</span>
        {event.link && (
          <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
        )}
      </div>
    </div>
  );

  if (event.link) {
    return (
      <li>
        <Link to={event.link} className="block">
          {content}
        </Link>
      </li>
    );
  }
  return <li>{content}</li>;
}
