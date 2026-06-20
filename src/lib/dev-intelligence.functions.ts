import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StageKey =
  | "solicitado"
  | "em_confeccao"
  | "em_prova"
  | "aprovado"
  | "reprovado";

export type StageStats = {
  stage: StageKey;
  avgDays: number;
  count: number;
};

export type StuckPrototype = {
  id: string;
  code: string;
  name: string | null;
  stage: StageKey;
  daysInStage: number;
  avgForStage: number;
  collectionName: string | null;
  productId: string | null;
};

export type DevInsight = {
  severity: "info" | "warn" | "critical";
  title: string;
  message: string;
};

export type DevIntelligence = {
  totalLeadTimeDays: number; // média solicitado→aprovado
  approvalRate: number; // % de aprovados / (aprovados + reprovados)
  bottleneck: StageKey | null;
  stageStats: StageStats[];
  stuck: StuckPrototype[];
  insights: DevInsight[];
};

const STAGES_ACTIVE: StageKey[] = ["solicitado", "em_confeccao", "em_prova"];

export const getDevIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DevIntelligence> => {
    // NOTE: `prototype_stage_log` table and several columns
    // (`prototypes.name`, `prototypes.stage_updated_at`) referenced below
    // are not present in the current generated Database types. Keeping `any`
    // here intentionally until the schema is reconciled — outside scope of
    // the typing refactor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const [{ data: logs }, { data: protos }, { data: collections }] =
      await Promise.all([
        sb
          .from("prototype_stage_log")
          .select("prototype_id, from_stage, to_stage, duration_seconds, created_at")
          .order("created_at", { ascending: true }),
        sb
          .from("prototypes")
          .select(
            "id, code, name, stage, created_at, stage_updated_at, product_id, products(name)",
          ),
        sb.from("collections").select("id, name"),
      ]);

    const logRows = (logs ?? []) as Array<{
      prototype_id: string;
      from_stage: StageKey | null;
      to_stage: StageKey;
      duration_seconds: number | null;
      created_at: string;
    }>;

    // Stage stats: average duration SPENT in a stage = duration_seconds on the
    // log entry that LEAVES that stage (from_stage).
    const buckets = new Map<StageKey, { total: number; n: number }>();
    for (const l of logRows) {
      if (!l.from_stage || !l.duration_seconds) continue;
      const b = buckets.get(l.from_stage) ?? { total: 0, n: 0 };
      b.total += l.duration_seconds;
      b.n += 1;
      buckets.set(l.from_stage, b);
    }
    const stageStats: StageStats[] = STAGES_ACTIVE.map((s) => {
      const b = buckets.get(s);
      const avgDays = b && b.n > 0 ? b.total / b.n / 86400 : 0;
      return { stage: s, avgDays, count: b?.n ?? 0 };
    });

    // Total lead time: sum of stage averages for completed prototypes
    const totalLeadTimeDays = stageStats.reduce((acc, s) => acc + s.avgDays, 0);

    // Approval rate
    let approved = 0;
    let rejected = 0;
    for (const p of protos ?? []) {
      if (p.stage === "aprovado") approved += 1;
      if (p.stage === "reprovado") rejected += 1;
    }
    const approvalRate =
      approved + rejected > 0 ? approved / (approved + rejected) : 0;

    // Bottleneck = stage with highest avg days (and at least 1 sample)
    const bottleneck =
      stageStats
        .filter((s) => s.count > 0)
        .sort((a, b) => b.avgDays - a.avgDays)[0]?.stage ?? null;

    // Stuck = active prototypes whose time in current stage > 1.5x avg
    const stuck: StuckPrototype[] = [];
    const now = Date.now();
    const collNameById = new Map<string, string>(
      (collections ?? []).map((c: any) => [c.id as string, c.name as string]),
    );
    for (const p of protos ?? []) {
      if (!STAGES_ACTIVE.includes(p.stage as StageKey)) continue;
      const since = new Date(p.stage_updated_at ?? p.created_at).getTime();
      const daysInStage = Math.max(0, (now - since) / 86400000);
      const stat = stageStats.find((s) => s.stage === p.stage);
      const avg = stat?.avgDays ?? 0;
      if (avg > 0 && daysInStage > avg * 1.5) {
        stuck.push({
          id: p.id,
          code: p.code,
          name: p.name ?? p.products?.name ?? null,
          stage: p.stage as StageKey,
          daysInStage: Math.round(daysInStage * 10) / 10,
          avgForStage: Math.round(avg * 10) / 10,
          collectionName: null, // protótipo ainda não tem FK direta de coleção
          productId: p.product_id,
        });
      }
    }
    stuck.sort((a, b) => b.daysInStage - a.daysInStage);

    const insights: DevInsight[] = [];
    if (bottleneck && (stageStats.find((s) => s.stage === bottleneck)?.avgDays ?? 0) > 7) {
      insights.push({
        severity: "warn",
        title: `Gargalo em "${bottleneck}"`,
        message: `Protótipos passam em média ${stageStats
          .find((s) => s.stage === bottleneck)
          ?.avgDays.toFixed(1)} dias neste estágio. Avalie capacidade ou priorize aprovações.`,
      });
    }
    if (stuck.length > 0) {
      insights.push({
        severity: stuck.length > 3 ? "critical" : "warn",
        title: `${stuck.length} protótipo${stuck.length > 1 ? "s" : ""} travado${stuck.length > 1 ? "s" : ""}`,
        message: `O mais antigo é ${stuck[0].code} (${stuck[0].daysInStage}d em ${stuck[0].stage}, média ${stuck[0].avgForStage}d).`,
      });
    }
    if (approved + rejected >= 5 && approvalRate < 0.6) {
      insights.push({
        severity: "warn",
        title: "Taxa de aprovação baixa",
        message: `Apenas ${(approvalRate * 100).toFixed(0)}% dos protótipos finalizados foram aprovados. Reveja briefing inicial e prova-piloto.`,
      });
    }
    if (insights.length === 0 && (protos ?? []).length > 0) {
      insights.push({
        severity: "info",
        title: "Funil de desenvolvimento saudável",
        message: `${stageStats.reduce((acc, s) => acc + s.count, 0)} transições registradas. Lead time médio: ${totalLeadTimeDays.toFixed(1)}d.`,
      });
    }

    return {
      totalLeadTimeDays,
      approvalRate,
      bottleneck,
      stageStats,
      stuck: stuck.slice(0, 10),
      insights,
    };
  });
