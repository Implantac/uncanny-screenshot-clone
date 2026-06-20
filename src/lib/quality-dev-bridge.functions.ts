import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PomIssue = {
  pom: string;
  count: number;
  criticalCount: number;
  pct: number;
};

export type AdjustmentReason = {
  reason: string;
  count: number;
  sectors: string[];
};

export type DevBridgeAnalysis = {
  windowDays: number;
  // protótipos
  totalPrototypes: number;
  approvedPrototypes: number;
  firstTimeRight: number; // % aprovados sem nenhum ajuste
  ftrCount: number;
  withAdjustments: number;
  avgLeadTimeDays: number;
  // fit
  totalFitSessions: number;
  avgIterations: number; // iterações médias até aprovar
  topPoms: PomIssue[];
  // ajustes recorrentes
  recurrentReasons: AdjustmentReason[];
  insight: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export const getDevBridgeAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DevBridgeAnalysis> => {
    const sb = context.supabase;
    const WINDOW = 90;
    const since = new Date(Date.now() - WINDOW * 86400000).toISOString();

    const [{ data: protos }, { data: adjs }, { data: fits }, { data: fitComments }] =
      await Promise.all([
        sb
          .from("prototypes")
          .select("id, stage, product_id, created_at, updated_at")
          .gte("created_at", since),
        sb
          .from("prototype_adjustments")
          .select("prototype_id, reason, sector, status, created_at")
          .gte("created_at", since),
        sb
          .from("fit_sessions")
          .select("id, prototype_id, iteration, status, session_date")
          .gte("session_date", since.slice(0, 10)),
        sb
          .from("fit_session_comments")
          .select("pom_label, severity, fit_session_id, created_at")
          .gte("created_at", since),
      ]);

    type Proto = {
      id: string;
      stage: string;
      created_at: string;
      updated_at: string;
    };
    type Adj = { prototype_id: string; reason: string; sector: string | null };
    type Fit = {
      prototype_id: string | null;
      iteration: number | null;
      status: string;
    };
    type FC = { pom_label: string | null; severity: string | null };

    const adjByProto = new Map<string, number>();
    const reasonAgg = new Map<string, { count: number; sectors: Set<string> }>();
    for (const a of (adjs ?? []) as Adj[]) {
      adjByProto.set(a.prototype_id, (adjByProto.get(a.prototype_id) ?? 0) + 1);
      const key = normalize(a.reason || "—");
      const r = reasonAgg.get(key) ?? { count: 0, sectors: new Set<string>() };
      r.count += 1;
      if (a.sector) r.sectors.add(a.sector);
      reasonAgg.set(key, r);
    }

    const protoList = (protos ?? []) as Proto[];
    const total = protoList.length;
    const approved = protoList.filter((p) => p.stage === "aprovado");
    const ftrCount = approved.filter((p) => !adjByProto.has(p.id)).length;
    const firstTimeRight = approved.length ? (ftrCount / approved.length) * 100 : 0;
    const withAdjustments = approved.length - ftrCount;

    const leadTimes = approved.map((p) => {
      const start = new Date(p.created_at).getTime();
      const end = new Date(p.updated_at).getTime();
      return Math.max(0, (end - start) / 86400000);
    });
    const avgLeadTimeDays = leadTimes.length
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    // iterações por protótipo (máx iteration registrado)
    const iterByProto = new Map<string, number>();
    for (const f of (fits ?? []) as Fit[]) {
      if (!f.prototype_id) continue;
      const cur = iterByProto.get(f.prototype_id) ?? 0;
      const it = Number(f.iteration ?? 1);
      if (it > cur) iterByProto.set(f.prototype_id, it);
    }
    const iters = Array.from(iterByProto.values());
    const avgIterations = iters.length ? iters.reduce((a, b) => a + b, 0) / iters.length : 0;

    // POMs problemáticos
    const pomAgg = new Map<string, { count: number; crit: number }>();
    const totalComments = (fitComments ?? []).length;
    for (const c of (fitComments ?? []) as FC[]) {
      const k = (c.pom_label || "geral").trim().toLowerCase();
      const a = pomAgg.get(k) ?? { count: 0, crit: 0 };
      a.count += 1;
      if (c.severity === "critica" || c.severity === "alta") a.crit += 1;
      pomAgg.set(k, a);
    }
    const topPoms: PomIssue[] = Array.from(pomAgg.entries())
      .map(([pom, a]) => ({
        pom,
        count: a.count,
        criticalCount: a.crit,
        pct: totalComments ? (a.count / totalComments) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const recurrentReasons: AdjustmentReason[] = Array.from(reasonAgg.entries())
      .filter(([, r]) => r.count >= 3)
      .map(([reason, r]) => ({
        reason,
        count: r.count,
        sectors: Array.from(r.sectors),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    let insight: string;
    if (total === 0) {
      insight = "Sem protótipos na janela — sem base para FTR ainda.";
    } else if (firstTimeRight >= 70) {
      insight = `FTR em ${firstTimeRight.toFixed(0)}% — desenvolvimento maduro. Mantenha fichas técnicas atualizadas.`;
    } else if (firstTimeRight >= 50) {
      insight = `FTR em ${firstTimeRight.toFixed(0)}% — média de ${avgIterations.toFixed(1)} iterações por peça. ${topPoms[0]?.pom ? `Foco em "${topPoms[0].pom}".` : ""}`;
    } else {
      insight = `FTR baixo (${firstTimeRight.toFixed(0)}%) — ${withAdjustments} de ${approved.length} aprovados precisaram de ajustes. ${recurrentReasons[0] ? `Recorrência crítica em "${recurrentReasons[0].reason}".` : "Reveja brief e ficha técnica."}`;
    }

    return {
      windowDays: WINDOW,
      totalPrototypes: total,
      approvedPrototypes: approved.length,
      firstTimeRight,
      ftrCount,
      withAdjustments,
      avgLeadTimeDays,
      totalFitSessions: (fits ?? []).length,
      avgIterations,
      topPoms,
      recurrentReasons,
      insight,
    };
  });
