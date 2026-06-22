import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GanttChart, Loader2, AlertTriangle, Calendar } from "lucide-react";
import { getApsGantt, type GanttResponse } from "@/lib/pcp-gantt.functions";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DAY_MS = 86_400_000;

export function PcpApsGantt() {
  const fn = useServerFn(getApsGantt);
  const q = useQuery({
    queryKey: ["pcp-aps-gantt"],
    queryFn: () => fn() as Promise<GanttResponse>,
    refetchInterval: 90_000,
  });

  const data = q.data;

  const scale = useMemo(() => {
    if (!data) return null;
    const start = new Date(data.window_start).getTime();
    const end = new Date(data.window_end).getTime();
    const span = Math.max(1, end - start);
    const days = Math.ceil(span / DAY_MS);
    const ticks = Array.from({ length: Math.min(days + 1, 30) }, (_, i) => {
      const ts = start + i * DAY_MS;
      const left = ((ts - start) / span) * 100;
      return { ts, left, label: new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
    });
    const nowLeft = ((Date.now() - start) / span) * 100;
    return { start, end, span, ticks, nowLeft };
  }, [data]);

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 px-3">
        <Loader2 className="size-3.5 animate-spin" /> Montando Gantt…
      </div>
    );
  }
  if (!data || data.rows.length === 0 || !scale) {
    return (
      <div className="text-xs text-muted-foreground py-6 px-3">
        Sem OPs ativas para projetar.
      </div>
    );
  }

  const critCount = data.rows.filter((r) => r.critical).length;

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GanttChart className="size-4 text-primary" />
            Gantt APS · projeção por estágio
          </div>
          {critCount > 0 && (
            <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
              <AlertTriangle className="size-3" /> {critCount} crítica{critCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="px-3 pb-3 overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Régua temporal */}
            <div className="relative h-6 border-b border-border/60 mb-1.5">
              {scale.ticks.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 text-[10px] text-muted-foreground"
                  style={{ left: `${t.left}%` }}
                >
                  <div className="border-l border-border/40 h-full pl-1">{t.label}</div>
                </div>
              ))}
              {scale.nowLeft >= 0 && scale.nowLeft <= 100 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/70 z-10"
                  style={{ left: `${scale.nowLeft}%` }}
                  aria-label="agora"
                />
              )}
            </div>

            {/* Linhas */}
            <ul className="space-y-1">
              {data.rows.map((r) => (
                <li key={r.id} className="grid grid-cols-[180px_1fr] items-center gap-2 group">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] truncate">{r.code}</span>
                      {r.critical && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-destructive/10 text-destructive border-destructive/30">
                          +{r.delay_days}d
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.product_name ?? r.product_sku ?? "—"}
                    </div>
                  </div>

                  <div className="relative h-7 rounded bg-muted/30">
                    {/* due_date marker */}
                    {r.due_date && (() => {
                      const left = ((new Date(r.due_date).getTime() - scale.start) / scale.span) * 100;
                      if (left < 0 || left > 100) return null;
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-0 bottom-0 w-px bg-amber-500/80 z-[5]"
                              style={{ left: `${left}%` }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <Calendar className="size-3 inline mr-1" />
                            Entrega: {new Date(r.due_date).toLocaleDateString("pt-BR")}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}

                    {r.segments.map((s, i) => {
                      const segStart = new Date(s.start).getTime();
                      const segEnd = new Date(s.end).getTime();
                      const left = ((segStart - scale.start) / scale.span) * 100;
                      const width = ((segEnd - segStart) / scale.span) * 100;
                      if (left + width < 0 || left > 100) return null;
                      const bg = s.is_done
                        ? "bg-muted-foreground/30"
                        : s.is_current
                          ? r.critical ? "bg-destructive" : "bg-primary"
                          : r.critical ? "bg-destructive/40" : "bg-primary/40";
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-1 bottom-1 rounded-sm ${bg} hover:ring-2 hover:ring-primary/40 transition`}
                              style={{
                                left: `${Math.max(0, left)}%`,
                                width: `${Math.max(0.5, Math.min(100 - Math.max(0, left), width))}%`,
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium capitalize">{s.stage_label}</div>
                            <div className="text-muted-foreground">
                              {new Date(s.start).toLocaleDateString("pt-BR")} →{" "}
                              {new Date(s.end).toLocaleDateString("pt-BR")} · {s.duration_days}d
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            {/* Legenda */}
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-muted-foreground/30" /> concluído</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" /> em execução</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary/40" /> planejado</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-destructive" /> caminho crítico</span>
              <span className="flex items-center gap-1"><span className="w-px h-3 bg-amber-500/80" /> entrega</span>
              <span className="flex items-center gap-1"><span className="w-px h-3 bg-primary/70" /> agora</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
