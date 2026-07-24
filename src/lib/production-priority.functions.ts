import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wave 27 — Priorização adaptativa de produção
 *
 * Ranqueia OPs ativas por risco composto:
 *  - urgência (dias até due_date)
 *  - prioridade manual
 *  - dwell time no estágio (tempo parado)
 *  - scorecard do fornecedor (terceirizado / material) — quanto pior, mais risco
 *  - cobertura de materiais reservados vs. necessidade
 *
 * Sempre retorna reason (explicabilidade).
 */

const Input = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  sla_hours: z.number().int().min(1).max(240).optional(),
});

const OUTSOURCED_STAGES = new Set([
  "bordado_terc",
  "silk_terc",
  "costura_terc",
]);

export const getAdaptiveProductionPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 15;
    const slaHours = data.sla_hours ?? 48;

    // 1) OPs ativas
    const { data: ops, error: opErr } = await supabase
      .from("production_orders")
      .select(
        "id, code, product_id, supplier_id, quantity, due_date, stage, status, priority, stage_updated_at, updated_at, notes",
      )
      .eq("owner_id", userId)
      .in("status", ["aguardando", "em_producao", "atrasada"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500);
    if (opErr) throw opErr;
    const rows = ops ?? [];
    if (!rows.length) return { threshold_sla_h: slaHours, items: [] as Item[] };

    // 2) Suppliers + scorecards + materiais reservados
    const supplierIds = Array.from(
      new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]),
    );
    const productIds = Array.from(
      new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]),
    );
    const opIds = rows.map((r) => r.id);

    const [supRes, scoreRes, prodRes, resRes] = await Promise.all([
      supplierIds.length
        ? supabase
            .from("suppliers")
            .select("id, name")
            .in("id", supplierIds)
            .eq("owner_id", userId)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase
        .from("supplier_scorecards")
        .select("supplier_id, score, delta, computed_at")
        .eq("owner_id", userId)
        .order("computed_at", { ascending: false })
        .limit(1000),
      productIds.length
        ? supabase
            .from("products")
            .select("id, name, sku")
            .in("id", productIds)
            .eq("owner_id", userId)
        : Promise.resolve({ data: [] as { id: string; name: string | null; sku: string | null }[] }),
      supabase
        .from("material_reservations")
        .select("production_order_id, status")
        .in("production_order_id", opIds),
    ]);

    const supById = new Map(((supRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s]));
    const prodById = new Map(
      ((prodRes.data ?? []) as { id: string; name: string | null; sku: string | null }[]).map((p) => [p.id, p]),
    );

    const latestScore = new Map<string, { score: number; delta: number | null }>();
    for (const s of scoreRes.data ?? []) {
      if (latestScore.has(s.supplier_id)) continue;
      latestScore.set(s.supplier_id, {
        score: Number(s.score ?? 0),
        delta: s.delta != null ? Number(s.delta) : null,
      });
    }

    const resByOp = new Map<string, { total: number; active: number }>();
    for (const r of resRes.data ?? []) {
      const cur = resByOp.get(r.production_order_id) ?? { total: 0, active: 0 };
      cur.total += 1;
      if (r.status === "ativa") cur.active += 1;
      resByOp.set(r.production_order_id, cur);
    }

    // 3) Compute risk
    type Item = {
      op_id: string;
      code: string;
      product_id: string | null;
      product_name: string | null;
      product_sku: string | null;
      supplier_id: string | null;
      supplier_name: string | null;
      supplier_score: number | null;
      stage: string | null;
      status: string | null;
      quantity: number | null;
      due_date: string | null;
      days_to_due: number | null;
      dwell_hours: number;
      material_coverage_pct: number | null;
      risk: number;
      reasons: string[];
    };

    const now = Date.now();
    const items: Item[] = rows.map((o) => {
      const prod = o.product_id ? prodById.get(o.product_id) : null;
      const supRow = o.supplier_id ? supById.get(o.supplier_id) : null;
      const sc = o.supplier_id ? latestScore.get(o.supplier_id) ?? null : null;
      const dueMs = o.due_date ? new Date(o.due_date).getTime() : null;
      const daysToDue = dueMs != null ? Math.round((dueMs - now) / 86_400_000) : null;
      const stageChangedMs = o.stage_updated_at
        ? new Date(o.stage_updated_at).getTime()
        : new Date(o.updated_at ?? o.stage_updated_at ?? new Date().toISOString()).getTime();
      const dwellH = Math.max(0, (now - stageChangedMs) / 3_600_000);
      const priority = Number(o.priority ?? 3);

      const cov = resByOp.get(o.id);
      const coveragePct =
        cov && cov.total > 0 ? Math.round(((cov.total - cov.active) / cov.total) * 100) : null;

      const reasons: string[] = [];

      // Urgency (0-40)
      let urgency = 15;
      if (daysToDue != null) {
        if (daysToDue < 0) {
          urgency = 40;
          reasons.push(`atrasada em ${Math.abs(daysToDue)}d`);
        } else if (daysToDue <= 3) {
          urgency = 34;
          reasons.push(`vence em ${daysToDue}d`);
        } else if (daysToDue <= 7) {
          urgency = 22;
        } else {
          urgency = Math.max(6, 20 - Math.min(14, daysToDue));
        }
      }

      // Priority weight (0-15)
      const prioW = Math.min(15, Math.max(0, (priority - 1) * 3.75));
      if (priority >= 4) reasons.push(`prioridade ${priority}`);

      // Dwell (0-20)
      const dwellRatio = dwellH / slaHours;
      const dwellScore = Math.min(20, dwellRatio * 20);
      if (dwellRatio >= 1)
        reasons.push(`parada há ${Math.round(dwellH)}h (${Math.round(dwellRatio * 100)}% do SLA)`);

      // Supplier scorecard (0-15) — penaliza pior score, ainda mais se stage terceirizado
      let supRisk = 0;
      if (sc) {
        const outsourced = OUTSOURCED_STAGES.has(o.stage ?? "");
        const base = Math.max(0, 100 - sc.score); // 0..100
        supRisk = Math.min(15, (base / 100) * (outsourced ? 15 : 8));
        if (sc.score < 45) {
          reasons.push(
            outsourced
              ? `fornecedor terceirizado em zona crítica (${Math.round(sc.score)})`
              : `fornecedor em zona crítica (${Math.round(sc.score)})`,
          );
        } else if (sc.delta != null && sc.delta <= -10) {
          reasons.push(`fornecedor caindo ${sc.delta}pts`);
        }
      }

      // Material coverage (0-10) — quanto menos coberto, mais risco
      let matRisk = 0;
      if (coveragePct != null) {
        matRisk = Math.max(0, ((100 - coveragePct) / 100) * 10);
        if (coveragePct < 60) reasons.push(`cobertura de materiais ${coveragePct}%`);
      }

      const risk = Math.round(urgency + prioW + dwellScore + supRisk + matRisk);

      return {
        op_id: o.id,
        code: o.code,
        product_id: o.product_id,
        product_name: prod?.name ?? null,
        product_sku: prod?.sku ?? null,
        supplier_id: o.supplier_id,
        supplier_name: supRow?.name ?? null,
        supplier_score: sc?.score ?? null,
        stage: o.stage,
        status: o.status,
        quantity: o.quantity,
        due_date: o.due_date,
        days_to_due: daysToDue,
        dwell_hours: Math.round(dwellH),
        material_coverage_pct: coveragePct,
        risk,
        reasons: reasons.length ? reasons : ["fluxo normal"],
      };
    });

    items.sort((a, b) => b.risk - a.risk);
    return { threshold_sla_h: slaHours, items: items.slice(0, limit) };
  });
