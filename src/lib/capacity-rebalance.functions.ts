import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiReason } from "@/lib/ai-reason";

/**
 * Wave 28 — Auto-rebalanceamento de capacidade
 *
 * Cruza:
 *  - OPs de alto risco (adaptive priority) em estágios terceirizados
 *  - Fornecedores por categoria com capacidade declarada (supplier_capacity)
 *  - WIP atual por fornecedor
 *  - Scorecard mais recente
 *
 * Sugere transferência de OP para fornecedor com:
 *  - mesma categoria (bordado/silk/costura)
 *  - scorecard >= atual + margem
 *  - ocupação abaixo do limite
 */

const OUTSOURCED_TO_CATEGORY: Record<string, string> = {
  bordado_terc: "bordado",
  silk_terc: "silk",
  costura_terc: "costura",
};

const Input = z.object({
  risk_threshold: z.number().int().min(0).max(200).optional(),
  occupancy_max: z.number().int().min(0).max(200).optional(),
  score_margin: z.number().int().min(0).max(50).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

type OpRow = {
  id: string;
  code: string;
  product_id: string | null;
  supplier_id: string | null;
  quantity: number | null;
  progress: number | null;
  due_date: string | null;
  stage: string | null;
  status: string | null;
  priority: number | null;
  stage_updated_at: string | null;
};

export const getCapacityRebalanceSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const riskMin = data.risk_threshold ?? 65;
    const occupancyMax = data.occupancy_max ?? 80;
    const scoreMargin = data.score_margin ?? 10;
    const limit = data.limit ?? 8;

    const outsourcedStages = Object.keys(OUTSOURCED_TO_CATEGORY);

    // 1) OPs ativas em estágios terceirizados
    const { data: rawOps, error: opErr } = await supabase
      .from("production_orders")
      .select(
        "id, code, product_id, supplier_id, quantity, progress, due_date, stage, status, priority, stage_updated_at",
      )
      .eq("owner_id", userId)
      .in("status", ["aguardando", "em_producao", "atrasada"])
      .in("stage", outsourcedStages)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300);
    if (opErr) throw opErr;
    const ops = (rawOps ?? []) as OpRow[];
    if (!ops.length) return { total: 0, suggestions: [] as Suggestion[] };

    // 2) Suppliers + scorecards + capacidade
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name, category, active")
      .eq("owner_id", userId);
    const supById = new Map((suppliers ?? []).map((s) => [s.id, s]));

    const { data: caps } = await supabase
      .from("supplier_capacity")
      .select("supplier_id, pieces_per_day, working_days_per_week")
      .eq("owner_id", userId);
    const capBySup = new Map(
      (caps ?? []).map((c) => [
        c.supplier_id,
        {
          pieces_per_day: Number(c.pieces_per_day ?? 0),
          working_days_per_week: Number(c.working_days_per_week ?? 5),
        },
      ]),
    );

    const { data: scores } = await supabase
      .from("supplier_scorecards")
      .select("supplier_id, score, delta, computed_at")
      .eq("owner_id", userId)
      .order("computed_at", { ascending: false })
      .limit(1000);
    const scoreBySup = new Map<string, { score: number; delta: number | null }>();
    for (const s of scores ?? []) {
      if (scoreBySup.has(s.supplier_id)) continue;
      scoreBySup.set(s.supplier_id, {
        score: Number(s.score ?? 0),
        delta: s.delta != null ? Number(s.delta) : null,
      });
    }

    // 3) WIP por fornecedor (para ocupação)
    const { data: activeOps } = await supabase
      .from("production_orders")
      .select("supplier_id, quantity, progress, status")
      .eq("owner_id", userId)
      .in("status", ["aguardando", "em_producao", "atrasada"]);
    const wipBySup = new Map<string, number>();
    for (const o of activeOps ?? []) {
      if (!o.supplier_id) continue;
      const remaining = Math.max(
        0,
        Math.round(Number(o.quantity ?? 0) * (1 - Number(o.progress ?? 0) / 100)),
      );
      wipBySup.set(o.supplier_id, (wipBySup.get(o.supplier_id) ?? 0) + remaining);
    }

    function occupancyPct(sid: string): number | null {
      const cap = capBySup.get(sid);
      if (!cap || cap.pieces_per_day <= 0) return null;
      const weekly = cap.pieces_per_day * cap.working_days_per_week;
      const horizonPieces = weekly * 4; // 4 semanas
      const wip = wipBySup.get(sid) ?? 0;
      return Math.round((wip / Math.max(1, horizonPieces)) * 100);
    }

    // 4) Produtos (nome)
    const productIds = Array.from(
      new Set(ops.map((o) => o.product_id).filter(Boolean) as string[]),
    );
    const { data: products } = productIds.length
      ? await supabase
          .from("products")
          .select("id, name, sku")
          .in("id", productIds)
          .eq("owner_id", userId)
      : { data: [] as { id: string; name: string | null; sku: string | null }[] };
    const prodById = new Map((products ?? []).map((p) => [p.id, p]));

    type Alt = {
      supplier_id: string;
      supplier_name: string;
      score: number | null;
      delta: number | null;
      occupancy_pct: number | null;
      pieces_per_day: number;
      slack_pct: number;
    };

    type Suggestion = {
      op_id: string;
      code: string;
      stage: string;
      category: string;
      product_id: string | null;
      product_name: string | null;
      quantity_remaining: number;
      due_date: string | null;
      current_supplier_id: string | null;
      current_supplier_name: string | null;
      current_score: number | null;
      current_occupancy_pct: number | null;
      risk_score: number;
      reason: string;
      alternatives: Alt[];
    };

    const now = Date.now();
    const suggestions: Suggestion[] = [];

    for (const op of ops) {
      const stage = op.stage ?? "";
      const category = OUTSOURCED_TO_CATEGORY[stage];
      if (!category) continue;

      // Composite risk (simplificado, alinhado com Wave 27)
      const daysToDue = op.due_date
        ? Math.round((new Date(op.due_date).getTime() - now) / 86_400_000)
        : null;
      const stageChanged = op.stage_updated_at
        ? new Date(op.stage_updated_at).getTime()
        : now;
      const dwellH = Math.max(0, (now - stageChanged) / 3_600_000);
      const priority = Number(op.priority ?? 3);
      const curScore = op.supplier_id ? scoreBySup.get(op.supplier_id)?.score ?? null : null;
      const curOcc = op.supplier_id ? occupancyPct(op.supplier_id) : null;

      let risk = 20;
      if (daysToDue != null) {
        if (daysToDue < 0) risk += 40;
        else if (daysToDue <= 3) risk += 30;
        else if (daysToDue <= 7) risk += 18;
      }
      if (priority >= 4) risk += (priority - 3) * 5;
      if (dwellH >= 48) risk += Math.min(20, Math.round(dwellH / 12));
      if (curScore != null && curScore < 45) risk += 15;
      if (curOcc != null && curOcc >= 100) risk += 15;

      if (risk < riskMin) continue;

      const remaining = Math.max(
        0,
        Math.round(Number(op.quantity ?? 0) * (1 - Number(op.progress ?? 0) / 100)),
      );
      if (remaining <= 0) continue;

      // Buscar alternativas: mesma categoria, ativos, com capacidade, score > atual+margin, ocupação <= max
      const targetScore = (curScore ?? 0) + scoreMargin;
      const alts: Alt[] = [];
      for (const s of suppliers ?? []) {
        if (s.id === op.supplier_id) continue;
        if (s.active === false) continue;
        if (!s.category || s.category.toLowerCase() !== category.toLowerCase()) continue;
        const sc = scoreBySup.get(s.id);
        const occ = occupancyPct(s.id);
        const cap = capBySup.get(s.id);
        if (!cap || cap.pieces_per_day <= 0) continue;
        if (occ != null && occ > occupancyMax) continue;
        if (sc && sc.score < targetScore && sc.score < 60) continue;
        alts.push({
          supplier_id: s.id,
          supplier_name: s.name,
          score: sc?.score ?? null,
          delta: sc?.delta ?? null,
          occupancy_pct: occ,
          pieces_per_day: cap.pieces_per_day,
          slack_pct: occ != null ? Math.max(0, 100 - occ) : 100,
        });
      }

      alts.sort((a, b) => {
        const sa = (a.score ?? 50) + a.slack_pct * 0.5;
        const sb = (b.score ?? 50) + b.slack_pct * 0.5;
        return sb - sa;
      });

      if (!alts.length) continue;

      const reason = buildAiReason({
        signals: [
          curScore != null ? `atual ${supById.get(op.supplier_id ?? "")?.name ?? "fornecedor"} score ${Math.round(curScore)}` : "sem scorecard atual",
          curOcc != null ? `ocupação ${curOcc}%` : "capacidade não declarada",
          daysToDue != null && daysToDue < 3 ? `vence em ${daysToDue}d` : `risco ${risk}`,
        ],
        recommendation: `transferir ${remaining} peças para ${alts[0].supplier_name}`,
      });

      suggestions.push({
        op_id: op.id,
        code: op.code,
        stage,
        category,
        product_id: op.product_id,
        product_name: op.product_id ? prodById.get(op.product_id)?.name ?? null : null,
        quantity_remaining: remaining,
        due_date: op.due_date,
        current_supplier_id: op.supplier_id,
        current_supplier_name: op.supplier_id ? supById.get(op.supplier_id)?.name ?? null : null,
        current_score: curScore,
        current_occupancy_pct: curOcc,
        risk_score: risk,
        reason,
        alternatives: alts.slice(0, 3),
      });
    }

    suggestions.sort((a, b) => b.risk_score - a.risk_score);
    return {
      total: suggestions.length,
      suggestions: suggestions.slice(0, limit),
    };
  });

export type Suggestion = {
  op_id: string;
  code: string;
  stage: string;
  category: string;
  product_id: string | null;
  product_name: string | null;
  quantity_remaining: number;
  due_date: string | null;
  current_supplier_id: string | null;
  current_supplier_name: string | null;
  current_score: number | null;
  current_occupancy_pct: number | null;
  risk_score: number;
  reason: string;
  alternatives: Array<{
    supplier_id: string;
    supplier_name: string;
    score: number | null;
    delta: number | null;
    occupancy_pct: number | null;
    pieces_per_day: number;
    slack_pct: number;
  }>;
};
