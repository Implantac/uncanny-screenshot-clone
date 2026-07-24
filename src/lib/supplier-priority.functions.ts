import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wave 26 — Priorização adaptativa de compras/produção
 * Cruza supplier_scorecards com POs abertas para sugerir substituição de fornecedores em zona crítica.
 */

const Input = z.object({
  critical_threshold: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  alternatives: z.number().int().min(1).max(5).optional(),
});

type ScoreRow = {
  supplier_id: string;
  score: number;
  delta: number | null;
  computed_at: string;
  notes: string | null;
};

export const getSupplierSwapSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const criticalThreshold = data.critical_threshold ?? 45;
    const limit = data.limit ?? 10;
    const altCount = data.alternatives ?? 3;

    // Latest scorecard per supplier (owner-scoped)
    const { data: scores, error: se } = await supabase
      .from("supplier_scorecards")
      .select("supplier_id, score, delta, computed_at, notes")
      .eq("owner_id", userId)
      .order("computed_at", { ascending: false })
      .limit(1000);
    if (se) throw se;

    const latestBy = new Map<string, ScoreRow>();
    for (const r of scores ?? []) {
      if (latestBy.has(r.supplier_id)) continue;
      latestBy.set(r.supplier_id, {
        supplier_id: r.supplier_id,
        score: Number(r.score ?? 0),
        delta: r.delta != null ? Number(r.delta) : null,
        computed_at: r.computed_at,
        notes: r.notes ?? null,
      });
    }

    // Ranked alternatives (best scorecards)
    const ranked = Array.from(latestBy.values()).sort((a, b) => b.score - a.score);

    // Load supplier names
    const { data: suppliers, error: supErr } = await supabase
      .from("suppliers")
      .select("id, name, category, active")
      .eq("owner_id", userId);
    if (supErr) throw supErr;
    const supById = new Map((suppliers ?? []).map((s) => [s.id, s]));

    // Open POs (rascunho, cotando, aprovado) with a supplier assigned
    const { data: pos, error: poErr } = await supabase
      .from("purchase_orders")
      .select("id, code, supplier_id, status, expected_date, created_at")
      .eq("owner_id", userId)
      .in("status", ["rascunho", "cotando", "aprovado"])
      .not("supplier_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (poErr) throw poErr;

    type Suggestion = {
      po_id: string;
      po_code: string;
      po_status: string;
      expected_date: string | null;
      supplier_id: string;
      supplier_name: string;
      supplier_category: string | null;
      current_score: number;
      current_delta: number | null;
      alternatives: Array<{
        supplier_id: string;
        supplier_name: string;
        score: number;
        delta: number | null;
        category: string | null;
      }>;
    };

    const suggestions: Suggestion[] = [];
    for (const po of pos ?? []) {
      const sid = po.supplier_id as string;
      const score = latestBy.get(sid);
      if (!score || score.score >= criticalThreshold) continue;
      const sup = supById.get(sid);
      const category = sup?.category ?? null;

      const alts = ranked
        .filter((r) => {
          if (r.supplier_id === sid) return false;
          if (r.score < criticalThreshold + 15) return false;
          const cand = supById.get(r.supplier_id);
          if (!cand || cand.active === false) return false;
          if (category && cand.category && cand.category !== category) return false;
          return true;
        })
        .slice(0, altCount)
        .map((r) => ({
          supplier_id: r.supplier_id,
          supplier_name: supById.get(r.supplier_id)?.name ?? "Fornecedor",
          score: r.score,
          delta: r.delta,
          category: supById.get(r.supplier_id)?.category ?? null,
        }));

      suggestions.push({
        po_id: po.id,
        po_code: po.code,
        po_status: po.status,
        expected_date: po.expected_date,
        supplier_id: sid,
        supplier_name: sup?.name ?? "Fornecedor",
        supplier_category: category,
        current_score: score.score,
        current_delta: score.delta,
        alternatives: alts,
      });
      if (suggestions.length >= limit) break;
    }

    return {
      threshold: criticalThreshold,
      total: suggestions.length,
      suggestions,
    };
  });
