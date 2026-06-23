import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Flame, GaugeCircle, TimerReset, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type StageLog = {
  id: string;
  order_id: string;
  from_stage: string | null;
  to_stage: string;
  quantity: number | null;
  is_partial: boolean | null;
  created_at: string;
};

type OpenOrder = {
  id: string;
  stage: string;
  stage_updated_at: string | null;
  quantity: number | null;
};

const STAGE_LABEL: Record<string, string> = {
  cad: "CAD",
  modelagem: "Modelagem",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  concluido: "Concluído",
};

function fmtHours(h: number) {
  if (!isFinite(h) || h <= 0) return "0h";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const rh = Math.round(h - d * 24);
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

/**
 * Painel "Passagens por setor" — agrega o histórico de stage_log do lote
 * para mostrar: tempo médio em cada setor, tempo parado da peça atual,
 * setor gargalo e SLA vs realizado.
 */
export function LotePassagensPanel({
  orderIds,
  openOrders,
  logs,
  ownerId,
}: {
  orderIds: string[];
  openOrders: OpenOrder[];
  logs: StageLog[];
  ownerId: string | null;
}) {
  const { data: stageDefs = [] } = useQuery({
    enabled: !!ownerId,
    queryKey: ["pcp-stages-sla", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pcp_stages")
        .select("key, label, sla_stuck_days, position, color")
        .eq("owner_id", ownerId!)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const slaByStage = useMemo(() => {
    const m = new Map<string, { hours: number; color: string | null; label: string }>();
    for (const s of stageDefs) {
      m.set(s.key, {
        hours: Number(s.sla_stuck_days ?? 2) * 24,
        color: s.color ?? null,
        label: s.label ?? STAGE_LABEL[s.key] ?? s.key,
      });
    }
    return m;
  }, [stageDefs]);

  /** Para cada (order_id, stage), calcula tempo total em horas que o lote ficou nesse setor. */
  const stats = useMemo(() => {
    // ordenado asc
    const asc = [...logs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const dwellByStage = new Map<string, { totalHours: number; samples: number }>();
    // marcadores: quando uma OP entra em `to_stage`, registra o `created_at`.
    // Quando sai (próximo log da mesma OP), fecha o intervalo.
    const entryByOrder = new Map<string, { stage: string; at: number }>();

    for (const l of asc) {
      const prev = entryByOrder.get(l.order_id);
      if (prev) {
        const hours = (new Date(l.created_at).getTime() - prev.at) / 36e5;
        if (hours > 0 && prev.stage) {
          const cur = dwellByStage.get(prev.stage) ?? { totalHours: 0, samples: 0 };
          cur.totalHours += hours;
          cur.samples += 1;
          dwellByStage.set(prev.stage, cur);
        }
      }
      entryByOrder.set(l.order_id, {
        stage: l.to_stage,
        at: new Date(l.created_at).getTime(),
      });
    }

    // Para OPs ainda ativas (sem log de saída) inclui dwell atual
    const now = Date.now();
    const dwellOpen = new Map<string, number>(); // stage -> max stuck hours (peça mais parada)
    for (const o of openOrders) {
      if (o.stage === "concluido") continue;
      if (!o.stage_updated_at) continue;
      const stuck = (now - new Date(o.stage_updated_at).getTime()) / 36e5;
      if (stuck <= 0) continue;
      const cur = dwellOpen.get(o.stage) ?? 0;
      dwellOpen.set(o.stage, Math.max(cur, stuck));
    }

    // monta linha por setor
    const stagesInLote = new Set<string>();
    logs.forEach((l) => {
      if (l.from_stage) stagesInLote.add(l.from_stage);
      stagesInLote.add(l.to_stage);
    });
    openOrders.forEach((o) => stagesInLote.add(o.stage));

    const rows = Array.from(stagesInLote)
      .filter((s) => s && s !== "concluido")
      .map((stage) => {
        const d = dwellByStage.get(stage) ?? { totalHours: 0, samples: 0 };
        const avg = d.samples > 0 ? d.totalHours / d.samples : 0;
        const stuck = dwellOpen.get(stage) ?? 0;
        const sla = slaByStage.get(stage)?.hours ?? 48;
        const overSla = stuck > sla;
        const opsInStage = openOrders.filter((o) => o.stage === stage).length;
        return {
          stage,
          label: slaByStage.get(stage)?.label ?? STAGE_LABEL[stage] ?? stage,
          color: slaByStage.get(stage)?.color ?? null,
          avgHours: avg,
          samples: d.samples,
          currentStuckHours: stuck,
          sla,
          overSla,
          opsInStage,
        };
      });

    // gargalo: setor com mais peças atualmente paradas + maior stuck
    const bottleneck = [...rows].sort((a, b) => {
      if (b.opsInStage !== a.opsInStage) return b.opsInStage - a.opsInStage;
      return b.currentStuckHours - a.currentStuckHours;
    })[0];

    const totalPassagens = logs.length;
    const partialPassagens = logs.filter((l) => l.is_partial).length;

    return { rows, bottleneck, totalPassagens, partialPassagens };
  }, [logs, openOrders, slaByStage]);

  if (orderIds.length === 0) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
          <GaugeCircle className="size-4 text-primary" /> Passagens por setor
        </div>
        <p className="text-xs text-muted-foreground">
          Sem OPs vinculadas para calcular passagens.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="text-sm font-semibold mb-3 flex items-center gap-2">
        <GaugeCircle className="size-4 text-primary" /> Passagens por setor
        <span className="text-[11px] font-normal text-muted-foreground ml-auto">
          {stats.totalPassagens} passagens · {stats.partialPassagens} parciais
        </span>
      </div>

      {stats.bottleneck && stats.bottleneck.opsInStage > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
          <Flame className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-600">Gargalo agora:</span>{" "}
            <span className="text-foreground">{stats.bottleneck.label}</span>{" "}
            <span className="text-muted-foreground">
              · {stats.bottleneck.opsInStage} OP(s) parada(s) há até{" "}
              {fmtHours(stats.bottleneck.currentStuckHours)} (SLA{" "}
              {fmtHours(stats.bottleneck.sla)})
            </span>
          </div>
        </div>
      )}

      {stats.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem passagens registradas ainda.</p>
      ) : (
        <div className="space-y-2">
          {stats.rows.map((r) => {
            const pctVsSla = r.sla > 0 ? Math.min(100, (r.currentStuckHours / r.sla) * 100) : 0;
            return (
              <div
                key={r.stage}
                className="rounded-lg border border-border bg-card/50 p-2.5 space-y-1.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: r.color ?? "hsl(var(--primary))" }}
                  />
                  <span className="text-sm font-medium">{r.label}</span>
                  {r.opsInStage > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/30 text-[10px]"
                    >
                      {r.opsInStage} OP{r.opsInStage > 1 ? "s" : ""} aqui agora
                    </Badge>
                  )}
                  {r.overSla && (
                    <Badge
                      variant="outline"
                      className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] gap-1"
                    >
                      <TimerReset className="size-3" /> SLA estourado
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                    <Hourglass className="size-3" />
                    média {r.samples > 0 ? fmtHours(r.avgHours) : "—"}
                    {r.samples > 0 && ` (${r.samples}x)`}
                  </span>
                </div>
                {r.opsInStage > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      Peça mais parada há {fmtHours(r.currentStuckHours)} · SLA {fmtHours(r.sla)}
                    </div>
                    <Progress
                      value={pctVsSla}
                      className={`h-1.5 ${r.overSla ? "[&>div]:bg-destructive" : ""}`}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground">
        <ArrowRight className="size-3" /> SLA por setor configurável em PCP · Etapas
      </div>
    </div>
  );
}
