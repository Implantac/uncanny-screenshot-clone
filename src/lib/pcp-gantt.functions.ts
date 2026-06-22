import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiReason } from "@/lib/ai-reason";

/**
 * Gantt APS — para cada OP ativa, projeta janela (start/end) por estágio
 * restante usando `pcp_stages.sla_stuck_days` como duração nominal.
 * Marca caminho crítico quando o término projetado ultrapassa `due_date`.
 */

type OrderRow = {
  id: string;
  code: string;
  product_id: string | null;
  supplier_id: string | null;
  quantity: number | null;
  due_date: string | null;
  stage: string | null;
  status: string | null;
  priority: number | null;
  stage_updated_at: string | null;
  started_at: string | null;
};

const ACTIVE = ["aguardando", "em_producao", "atrasada"] as const;
const TERMINAL = new Set(["entregue", "cancelada"]);
const DAY_MS = 86_400_000;

export type GanttSegment = {
  stage_key: string;
  stage_label: string;
  color: string | null;
  start: string;
  end: string;
  duration_days: number;
  is_current: boolean;
  is_done: boolean;
};

export type GanttRow = {
  id: string;
  code: string;
  product_name: string | null;
  product_sku: string | null;
  supplier_id: string | null;
  due_date: string | null;
  projected_end: string;
  delay_days: number;
  critical: boolean;
  current_stage: string | null;
  priority: number;
  segments: GanttSegment[];
  reason: string;
};

export type GanttResponse = {
  window_start: string;
  window_end: string;
  stages: { key: string; label: string; color: string | null; position: number }[];
  rows: GanttRow[];
};

export const getApsGantt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GanttResponse> => {
    const { supabase, userId } = context;

    const [{ data: stages }, { data: orders }] = await Promise.all([
      supabase
        .from("pcp_stages")
        .select("key, label, color, position, sla_stuck_days, active")
        .eq("owner_id", userId)
        .eq("active", true)
        .order("position", { ascending: true }),
      supabase
        .from("production_orders")
        .select(
          "id, code, product_id, supplier_id, quantity, due_date, stage, status, priority, stage_updated_at, started_at",
        )
        .eq("owner_id", userId)
        .in("status", ACTIVE)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);

    const stageList = (stages ?? []).filter(
      (s) => !TERMINAL.has(s.key),
    );
    const stageIndex = new Map(stageList.map((s, i) => [s.key, i]));

    const rows = ((orders ?? []) as OrderRow[]).filter(
      (o) => !TERMINAL.has(o.stage ?? ""),
    );

    const pids = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]));
    const products: Record<string, { name: string | null; sku: string | null }> = {};
    if (pids.length) {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", pids);
      for (const p of data ?? []) products[p.id] = { name: p.name, sku: p.sku };
    }

    const now = Date.now();
    let windowEnd = now;

    const built: GanttRow[] = rows.map((o) => {
      const curIdx = stageIndex.get(o.stage ?? "") ?? 0;
      // Start cursor = stage_updated_at or started_at or now
      let cursor =
        o.stage_updated_at ? new Date(o.stage_updated_at).getTime() :
        o.started_at ? new Date(o.started_at).getTime() : now;
      if (cursor < now - 14 * DAY_MS) cursor = now; // não retroceder demais

      const segments: GanttSegment[] = stageList.map((s, idx) => {
        const isDone = idx < curIdx;
        const isCurrent = idx === curIdx;
        const dur = Math.max(0.5, s.sla_stuck_days ?? 1);
        if (isDone) {
          // segmento concluído (visualização compacta no passado)
          const end = cursor;
          const start = end - dur * DAY_MS * 0.5;
          return {
            stage_key: s.key,
            stage_label: s.label,
            color: s.color,
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            duration_days: Math.round(dur * 10) / 10,
            is_current: false,
            is_done: true,
          };
        }
        const start = cursor;
        const end = start + dur * DAY_MS;
        cursor = end;
        return {
          stage_key: s.key,
          stage_label: s.label,
          color: s.color,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          duration_days: Math.round(dur * 10) / 10,
          is_current: isCurrent,
          is_done: false,
        };
      });

      const projectedEnd = cursor;
      windowEnd = Math.max(windowEnd, projectedEnd);

      const dueMs = o.due_date ? new Date(o.due_date).getTime() : null;
      const delayDays = dueMs ? Math.round((projectedEnd - dueMs) / DAY_MS) : 0;
      const critical = dueMs ? projectedEnd > dueMs : false;

      const product = o.product_id ? products[o.product_id] : null;

      const signals: string[] = [];
      if (critical && delayDays > 0) signals.push(`estoura prazo em ${delayDays}d`);
      else if (dueMs && delayDays <= -3) signals.push(`folga de ${Math.abs(delayDays)}d`);
      if ((o.priority ?? 3) >= 4) signals.push("prioridade alta");
      if (o.stage_updated_at) {
        const stallH = (now - new Date(o.stage_updated_at).getTime()) / 3_600_000;
        if (stallH >= 8) signals.push(`parado há ${Math.round(stallH)}h`);
      }

      return {
        id: o.id,
        code: o.code,
        product_name: product?.name ?? null,
        product_sku: product?.sku ?? null,
        supplier_id: o.supplier_id,
        due_date: o.due_date,
        projected_end: new Date(projectedEnd).toISOString(),
        delay_days: delayDays,
        critical,
        current_stage: o.stage,
        priority: o.priority ?? 3,
        segments,
        reason: buildAiReason({
          signals,
          recommendation: critical
            ? "antecipar etapa atual ou realocar capacidade"
            : (o.priority ?? 3) >= 4
              ? "manter no topo da fila"
              : null,
          fallback: "no plano",
        }),
      };
    });

    // ordenar: críticas primeiro, depois por due_date
    built.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });

    return {
      window_start: new Date(now - 2 * DAY_MS).toISOString(),
      window_end: new Date(windowEnd + 2 * DAY_MS).toISOString(),
      stages: stageList.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        position: s.position,
      })),
      rows: built.slice(0, 40),
    };
  });
