import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wave 25 — Supplier scorecard adaptativo
 * Lê snapshots recentes de supplier_scorecards para exibir score/tendência.
 */

const Input = z.object({
  supplier_id: z.string().uuid(),
  limit: z.number().int().min(1).max(90).optional(),
});

export const getSupplierScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 30;

    const { data: rows, error } = await supabase
      .from("supplier_scorecards")
      .select(
        "id, computed_at, window_days, otif_pct, lead_time_days, orders_count, occurrences_count, capa_reopened_count, fpy_pct, score, prev_score, delta, notes",
      )
      .eq("owner_id", userId)
      .eq("supplier_id", data.supplier_id)
      .order("computed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const list = rows ?? [];
    const latest = list[0] ?? null;
    const history = [...list].reverse().map((r) => ({
      at: r.computed_at,
      score: Number(r.score ?? 0),
    }));

    return {
      latest,
      history,
      count: list.length,
    };
  });

const TopInput = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export const getSupplierScorecardMovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TopInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dir = data.direction ?? "down";
    const limit = data.limit ?? 10;

    const { data: rows, error } = await supabase
      .from("supplier_scorecards")
      .select(
        "supplier_id, computed_at, score, prev_score, delta, notes, suppliers!inner(id,name)",
      )
      .eq("owner_id", userId)
      .not("delta", "is", null)
      .order("computed_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    // keep the latest per supplier
    const latestBySupplier = new Map<
      string,
      {
        supplier_id: string;
        supplier_name: string;
        score: number;
        prev_score: number | null;
        delta: number | null;
        computed_at: string;
        notes: string | null;
      }
    >();
    for (const r of rows ?? []) {
      if (latestBySupplier.has(r.supplier_id)) continue;
      const supplierRel = r.suppliers as unknown as { name?: string } | null;
      latestBySupplier.set(r.supplier_id, {
        supplier_id: r.supplier_id,
        supplier_name: supplierRel?.name ?? "Fornecedor",
        score: Number(r.score ?? 0),
        prev_score: r.prev_score != null ? Number(r.prev_score) : null,
        delta: r.delta != null ? Number(r.delta) : null,
        computed_at: r.computed_at,
        notes: r.notes ?? null,
      });
    }
    const arr = Array.from(latestBySupplier.values());
    arr.sort((a, b) => {
      const da = a.delta ?? 0;
      const db = b.delta ?? 0;
      return dir === "down" ? da - db : db - da;
    });
    return arr.slice(0, limit);
  });
