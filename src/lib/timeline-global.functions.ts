import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Timeline Global — unifica audit_logs, production_stage_log,
 * production_occurrences, quality_inspections, prototype_handoff_events
 * e marketing_notifications em um feed cronológico filtrável.
 */

export type TimelineSource =
  | "audit"
  | "stage"
  | "occurrence"
  | "inspection"
  | "prototype"
  | "marketing";

export type TimelineEvent = {
  id: string;
  source: TimelineSource;
  ts: string;
  actor: string | null;
  title: string;
  subtitle: string | null;
  entity: string | null;
  entity_id: string | null;
  link: string | null;
  severity: "info" | "success" | "warning" | "critical";
};

export type TimelineFilters = {
  sources?: TimelineSource[];
  severity?: TimelineEvent["severity"][];
  since_days?: number;
  search?: string;
  limit?: number;
};

const STAGE_LABEL: Record<string, string> = {
  cad: "CAD",
  modelagem: "Modelagem",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  entregue: "Entregue",
};

export const getGlobalTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TimelineFilters | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<TimelineEvent[]> => {
    const { supabase, userId } = context;
    const limit = Math.min(data.limit ?? 200, 500);
    const sinceDays = data.since_days ?? 14;
    const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const enabled = new Set<TimelineSource>(
      data.sources && data.sources.length
        ? data.sources
        : ["audit", "stage", "occurrence", "inspection", "prototype", "marketing"],
    );

    const results: TimelineEvent[] = [];

    // 1. audit_logs
    if (enabled.has("audit")) {
      const { data: rows } = await supabase
        .from("audit_logs")
        .select("id, created_at, action, entity, entity_id, actor_email, payload")
        .eq("user_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        const isOverride = r.action === "stage_override" || (r.payload as { override?: boolean } | null)?.override;
        results.push({
          id: `audit:${r.id}`,
          source: "audit",
          ts: r.created_at,
          actor: r.actor_email,
          title: `${humanize(r.entity)} · ${humanize(r.action)}`,
          subtitle: payloadSummary(r.payload),
          entity: r.entity,
          entity_id: r.entity_id,
          link: entityLink(r.entity, r.entity_id),
          severity: isOverride ? "warning" : r.action === "deleted" || r.action === "revoked" ? "critical" : "info",
        });
      }
    }

    // 2. production_stage_log
    if (enabled.has("stage")) {
      const { data: rows } = await supabase
        .from("production_stage_log")
        .select("id, created_at, from_stage, to_stage, quantity, is_partial, order_id, note")
        .eq("owner_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      const orderIds = Array.from(new Set((rows ?? []).map((r) => r.order_id)));
      const codes: Record<string, string> = {};
      if (orderIds.length) {
        const { data: ops } = await supabase
          .from("production_orders")
          .select("id, code")
          .in("id", orderIds);
        for (const o of ops ?? []) codes[o.id] = o.code;
      }
      for (const r of rows ?? []) {
        const from = STAGE_LABEL[r.from_stage ?? ""] ?? r.from_stage ?? "—";
        const to = STAGE_LABEL[r.to_stage] ?? r.to_stage;
        const isOverride = (r.note ?? "").includes("OVERRIDE");
        results.push({
          id: `stage:${r.id}`,
          source: "stage",
          ts: r.created_at,
          actor: null,
          title: `${codes[r.order_id] ?? "OP"} · ${from} → ${to}`,
          subtitle: r.is_partial ? `Parcial · ${r.quantity} pç` : r.note,
          entity: "production_order",
          entity_id: r.order_id,
          link: `/lote/${r.order_id}`,
          severity: isOverride ? "warning" : "success",
        });
      }
    }

    // 3. production_occurrences
    if (enabled.has("occurrence")) {
      const { data: rows } = await supabase
        .from("production_occurrences")
        .select("id, created_at, kind, description, status, sector, order_id, affected_qty")
        .eq("owner_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        const sev: TimelineEvent["severity"] =
          r.status === "aberta" && r.kind === "critica" ? "critical" :
          r.status === "aberta" ? "warning" : "info";
        results.push({
          id: `occ:${r.id}`,
          source: "occurrence",
          ts: r.created_at,
          actor: r.sector ?? null,
          title: `Ocorrência · ${humanize(r.kind)}`,
          subtitle: r.description ?? null,
          entity: "production_occurrence",
          entity_id: r.id,
          link: r.order_id ? `/lote/${r.order_id}` : null,
          severity: sev,
        });
      }
    }

    // 4. quality_inspections
    if (enabled.has("inspection")) {
      const { data: rows } = await supabase
        .from("quality_inspections")
        .select("id, created_at, inspection_type, result, critical_defects, major_defects, production_order_id")
        .eq("owner_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        const reproved = r.result === "reprovado" || r.result === "reprovada";
        results.push({
          id: `insp:${r.id}`,
          source: "inspection",
          ts: r.created_at,
          actor: null,
          title: `Inspeção ${r.inspection_type ?? ""} · ${humanize(r.result ?? "—")}`,
          subtitle:
            (r.critical_defects ?? 0) + (r.major_defects ?? 0) > 0
              ? `${r.critical_defects ?? 0} críticos, ${r.major_defects ?? 0} maiores`
              : null,
          entity: "quality_inspection",
          entity_id: r.id,
          link: r.production_order_id ? `/lote/${r.production_order_id}` : "/quality",
          severity: reproved ? ((r.critical_defects ?? 0) > 0 ? "critical" : "warning") : "success",
        });
      }
    }

    // 5. prototype_handoff_events
    if (enabled.has("prototype")) {
      const { data: rows } = await supabase
        .from("prototype_handoff_events")
        .select("id, created_at, event_type, from_role, to_role, prototype_id, note")
        .eq("owner_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        results.push({
          id: `proto:${r.id}`,
          source: "prototype",
          ts: r.created_at,
          actor: null,
          title: `Protótipo · ${humanize(r.event_type)}`,
          subtitle: [r.from_role, r.to_role].filter(Boolean).join(" → ") || r.note,
          entity: "prototype",
          entity_id: r.prototype_id,
          link: r.prototype_id ? `/prototipo/${r.prototype_id}` : null,
          severity: "info",
        });
      }
    }

    // 6. marketing_notifications
    if (enabled.has("marketing")) {
      const { data: rows } = await supabase
        .from("marketing_notifications")
        .select("id, created_at, kind, title, body, link")
        .eq("owner_id", userId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        results.push({
          id: `mkt:${r.id}`,
          source: "marketing",
          ts: r.created_at,
          actor: null,
          title: r.title,
          subtitle: r.body,
          entity: "marketing_notification",
          entity_id: r.id,
          link: r.link,
          severity: "info",
        });
      }
    }

    // Filtros pós-agregação
    let out = results;
    if (data.severity?.length) {
      const sev = new Set(data.severity);
      out = out.filter((e) => sev.has(e.severity));
    }
    if (data.search) {
      const q = data.search.toLowerCase();
      out = out.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.subtitle ?? "").toLowerCase().includes(q) ||
          (e.actor ?? "").toLowerCase().includes(q),
      );
    }

    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return out.slice(0, limit);
  });

function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function payloadSummary(p: unknown): string | null {
  if (!p || typeof p !== "object") return null;
  const obj = p as Record<string, unknown>;
  if (typeof obj.reason === "string") return obj.reason;
  if (typeof obj.to_stage === "string") return `→ ${obj.to_stage}`;
  const keys = Object.keys(obj).slice(0, 3);
  if (!keys.length) return null;
  return keys.map((k) => `${k}: ${JSON.stringify(obj[k]).slice(0, 40)}`).join(" · ");
}

function entityLink(entity: string, id: string | null): string | null {
  if (!id) return null;
  switch (entity) {
    case "production_order": return `/lote/${id}`;
    case "prototype": return `/prototipo/${id}`;
    case "tech_sheet": return `/ficha-tecnica`;
    case "collection": return `/colecoes`;
    case "supplier": return `/fornecedores`;
    case "product": return `/produtos`;
    default: return null;
  }
}
