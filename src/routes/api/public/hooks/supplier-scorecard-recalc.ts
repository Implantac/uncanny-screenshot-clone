import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Wave 25 — Supplier scorecard adaptativo
 * POST /api/public/hooks/supplier-scorecard-recalc
 *
 * Recalcula scorecards por fornecedor na janela (default 90d) usando dados
 * reais: OTIF, lead time médio, ocorrências negativas, CAPAs reabertas
 * (marker [reopened:...]) e FPY das inspeções. Persiste snapshot em
 * supplier_scorecards, atualiza suppliers.rating (0..5) e lead_time_days,
 * e dispara push quando o score cai >= 15 pontos em relação ao snapshot
 * anterior. Suporta { dryRun, windowDays, ownerId, supplierId }.
 */

const KIND_NEGATIVE = [
  "negativa",
  "falta_material",
  "erro_corte",
  "defeito_costura",
  "quebra_maquina",
  "atraso_fornecedor",
  "retrabalho",
  "descarte",
];

type Body = {
  dryRun?: boolean;
  windowDays?: number;
  ownerId?: string;
  supplierId?: string;
};

function verifyAuth(request: Request): boolean {
  const apiKey = request.headers.get("apikey");
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedApi =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const expectedCron = process.env.CRON_SECRET;
  if (expectedApi && apiKey === expectedApi) return true;
  if (expectedCron && cronSecret === expectedCron) return true;
  return false;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const Route = createFileRoute("/api/public/hooks/supplier-scorecard-recalc")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyAuth(request)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          body = {};
        }
        const dryRun = Boolean(body.dryRun);
        const windowDays = clamp(body.windowDays ?? 90, 7, 365);
        const sinceIso = new Date(Date.now() - windowDays * 86400_000).toISOString();

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response(JSON.stringify({ error: "missing supabase env" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient<Database>(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Fetch active suppliers to process (optionally filtered)
        let q = supabase
          .from("suppliers")
          .select("id, owner_id, name, rating, lead_time_days")
          .eq("active", true)
          .limit(2000);
        if (body.ownerId) q = q.eq("owner_id", body.ownerId);
        if (body.supplierId) q = q.eq("id", body.supplierId);
        const { data: suppliers, error: sErr } = await q;
        if (sErr) {
          return new Response(JSON.stringify({ error: sErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const summaries: Array<{
          supplier_id: string;
          owner_id: string;
          name: string;
          score: number;
          prev_score: number | null;
          delta: number | null;
          otif_pct: number | null;
          lead_time_days: number | null;
          occurrences: number;
          capa_reopened: number;
          fpy_pct: number | null;
          orders: number;
          notified: boolean;
        }> = [];

        for (const s of suppliers ?? []) {
          // Delivered orders in window
          const { data: doneOrders } = await supabase
            .from("production_orders")
            .select("id, due_date, started_at, updated_at, stage_updated_at, status")
            .eq("owner_id", s.owner_id)
            .eq("supplier_id", s.id)
            .eq("status", "concluida")
            .gte("updated_at", sinceIso);

          const done = doneOrders ?? [];
          const onTimeBase = done.filter((o) => o.due_date);
          const onTime = onTimeBase.filter(
            (o) =>
              new Date(o.updated_at).getTime() <=
              new Date(o.due_date as string).getTime() + 86_400_000,
          ).length;
          const otifPct =
            onTimeBase.length > 0 ? (onTime / onTimeBase.length) * 100 : null;

          const leads = done
            .map((o) => {
              const start = o.started_at ? new Date(o.started_at).getTime() : null;
              const end = new Date(o.updated_at).getTime();
              return start ? Math.max(0, (end - start) / 86_400_000) : null;
            })
            .filter((v): v is number => v !== null);
          const leadAvg =
            leads.length > 0
              ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10
              : null;

          // Orders (any) in window for occurrence scoping
          const { data: allOrders } = await supabase
            .from("production_orders")
            .select("id")
            .eq("owner_id", s.owner_id)
            .eq("supplier_id", s.id)
            .gte("created_at", sinceIso);
          const orderIds = (allOrders ?? []).map((o) => o.id);

          let occNeg = 0;
          if (orderIds.length) {
            const { count } = await supabase
              .from("production_occurrences")
              .select("id", { count: "exact", head: true })
              .eq("owner_id", s.owner_id)
              .in("order_id", orderIds)
              .in("kind", KIND_NEGATIVE)
              .gte("created_at", sinceIso);
            occNeg = count ?? 0;
          }

          // Inspections FPY
          const { data: insp } = await supabase
            .from("quality_inspections")
            .select("result")
            .eq("owner_id", s.owner_id)
            .eq("supplier_id", s.id)
            .gte("created_at", sinceIso);
          const inspRows = insp ?? [];
          const totalInsp = inspRows.length;
          const passed = inspRows.filter(
            (r) => r.result === "aprovado" || r.result === "aprovada",
          ).length;
          const fpyPct = totalInsp > 0 ? (passed / totalInsp) * 100 : null;

          // CAPAs reabertas
          const { data: capas } = await supabase
            .from("quality_capa")
            .select("effectiveness_check, updated_at")
            .eq("owner_id", s.owner_id)
            .eq("supplier_id", s.id)
            .gte("updated_at", sinceIso);
          const capaReopened = (capas ?? []).filter((c) =>
            (c.effectiveness_check ?? "").includes("[reopened:"),
          ).length;

          // Composite score 0..100
          // OTIF 35 | FPY 30 | Occurrence penalty up to -25 | CAPA reopen -10 each (max -20)
          // Lead time bonus/penalty ±10 vs supplier baseline (or 15d neutral)
          const otifScore = otifPct != null ? (otifPct / 100) * 35 : 20;
          const fpyScore = fpyPct != null ? (fpyPct / 100) * 30 : 18;
          const occRate =
            orderIds.length > 0 ? occNeg / orderIds.length : occNeg > 0 ? 1 : 0;
          const occPenalty = clamp(occRate * 25, 0, 25);
          const capaPenalty = clamp(capaReopened * 10, 0, 20);
          const baseline = s.lead_time_days ?? 15;
          let leadAdj = 0;
          if (leadAvg != null) {
            const diff = leadAvg - baseline;
            leadAdj = clamp(-diff, -10, 10); // faster than baseline -> positive
          }
          const rawBase = 40; // neutral base for unknowns
          const score = clamp(
            rawBase + otifScore + fpyScore - occPenalty - capaPenalty + leadAdj - 25,
            0,
            100,
          );
          const scoreRounded = Math.round(score * 10) / 10;

          // Prev score
          const { data: prev } = await supabase
            .from("supplier_scorecards")
            .select("score")
            .eq("owner_id", s.owner_id)
            .eq("supplier_id", s.id)
            .order("computed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const prevScore = prev?.score != null ? Number(prev.score) : null;
          const delta = prevScore != null ? Math.round((scoreRounded - prevScore) * 10) / 10 : null;

          const notes =
            `OTIF ${otifPct != null ? otifPct.toFixed(0) : "—"}% · FPY ${
              fpyPct != null ? fpyPct.toFixed(0) : "—"
            }% · ${occNeg} ocorr · ${capaReopened} CAPA reab · lead ${
              leadAvg != null ? `${leadAvg}d` : "—"
            }`;

          let notified = false;
          if (!dryRun) {
            await supabase.from("supplier_scorecards").insert({
              owner_id: s.owner_id,
              supplier_id: s.id,
              window_days: windowDays,
              otif_pct: otifPct,
              lead_time_days: leadAvg,
              orders_count: done.length,
              occurrences_count: occNeg,
              capa_reopened_count: capaReopened,
              fpy_pct: fpyPct,
              score: scoreRounded,
              prev_score: prevScore,
              delta,
              notes,
            });

            // Update suppliers.rating (0..5) and lead_time_days (only if we have samples)
            const newRating = Math.round(clamp(scoreRounded / 20, 0, 5));
            const patch: Record<string, unknown> = { rating: newRating };
            if (leadAvg != null) patch.lead_time_days = Math.round(leadAvg);
            await supabase.from("suppliers").update(patch).eq("id", s.id);

            // Push when drop >= 15 pts OR score < 40 with prev >= 40
            const bigDrop = delta != null && delta <= -15;
            const wentCritical =
              prevScore != null && prevScore >= 40 && scoreRounded < 40;
            if (bigDrop || wentCritical) {
              await supabase.from("push_notifications").insert({
                owner_id: s.owner_id,
                title: `Fornecedor ${s.name}: score ${scoreRounded.toFixed(0)}${
                  delta != null ? ` (${delta > 0 ? "+" : ""}${delta})` : ""
                }`,
                body: notes,
                link: `/fornecedores`,
                kind: "supplier_score_drop",
                severity: scoreRounded < 30 ? "alta" : "media",
                payload: {
                  supplier_id: s.id,
                  score: scoreRounded,
                  prev_score: prevScore,
                  delta,
                },
              });
              notified = true;
            }
          }

          summaries.push({
            supplier_id: s.id,
            owner_id: s.owner_id,
            name: s.name,
            score: scoreRounded,
            prev_score: prevScore,
            delta,
            otif_pct: otifPct,
            lead_time_days: leadAvg,
            occurrences: occNeg,
            capa_reopened: capaReopened,
            fpy_pct: fpyPct,
            orders: done.length,
            notified,
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            dryRun,
            windowDays,
            scanned: summaries.length,
            summaries,
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
