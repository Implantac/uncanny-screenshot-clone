/**
 * Eficiência real por célula (fornecedor).
 * Throughput observado (production_stage_log) ÷ capacidade declarada (supplier_capacity)
 * nos últimos N dias. Sinaliza gargalo e sugere ação.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CellEfficiency = {
  supplierId: string;
  supplierName: string;
  declaredPerDay: number;
  observedPerDay: number;
  efficiencyPct: number;
  windowDays: number;
  totalProduced: number;
  status: "ok" | "abaixo" | "ocioso" | "sem_capacidade";
  hint: string;
};

export type CellEfficiencyReport = {
  windowDays: number;
  cells: CellEfficiency[];
  insights: string[];
};

export const getCellEfficiency = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CellEfficiencyReport> => {
    const sb = context.supabase;
    const WINDOW = 30;
    const since = new Date(Date.now() - WINDOW * 86400000).toISOString();

    const [{ data: logs }, { data: orders }, { data: suppliers }, { data: caps }] =
      await Promise.all([
        sb
          .from("production_stage_log")
          .select("order_id, to_stage, quantity, created_at")
          .gte("created_at", since),
        sb.from("production_orders").select("id, supplier_id, quantity"),
        sb.from("suppliers").select("id, name"),
        sb
          .from("supplier_capacity")
          .select("supplier_id, pieces_per_day, working_days_per_week"),
      ]);

    type OrderRow = { id: string; supplier_id: string | null; quantity: number | null };
    type SupplierRow = { id: string; name: string };
    type CapRow = { supplier_id: string; pieces_per_day: number | null; working_days_per_week: number | null };
    type LogRow = { order_id: string | null; to_stage: string | null; quantity: number | null; created_at: string };

    const orderSup = new Map<string, string | null>();
    ((orders ?? []) as OrderRow[]).forEach((o) => orderSup.set(o.id, o.supplier_id));
    const supName = new Map<string, string>(
      ((suppliers ?? []) as SupplierRow[]).map((s) => [s.id, s.name]),
    );
    const capMap = new Map<string, { perDay: number; dpw: number }>(
      ((caps ?? []) as CapRow[]).map((c) => [
        c.supplier_id,
        { perDay: Number(c.pieces_per_day ?? 0), dpw: Number(c.working_days_per_week ?? 5) },
      ]),
    );

    // soma quantity por fornecedor (transições conclusivas: expedicao/acabamento)
    const produced = new Map<string, number>();
    ((logs ?? []) as LogRow[]).forEach((l) => {
      if (!l.order_id) return;
      const sid = orderSup.get(l.order_id);
      if (!sid) return;
      // contabiliza qualquer movimento de etapa com quantity > 0 (parciais incluídos)
      const q = Number(l.quantity ?? 0);
      if (q <= 0) return;
      produced.set(sid, (produced.get(sid) ?? 0) + q);
    });

    const cells: CellEfficiency[] = [];
    const allSupplierIds = new Set<string>([
      ...produced.keys(),
      ...capMap.keys(),
    ]);

    allSupplierIds.forEach((sid) => {
      const cap = capMap.get(sid);
      const total = produced.get(sid) ?? 0;
      const observedPerDay = total / WINDOW;
      const declaredPerDay = cap?.perDay ?? 0;
      const eff = declaredPerDay > 0 ? (observedPerDay / declaredPerDay) * 100 : 0;

      let status: CellEfficiency["status"];
      let hint: string;
      if (declaredPerDay === 0) {
        status = "sem_capacidade";
        hint = "Cadastrar capacidade declarada para medir eficiência real.";
      } else if (eff < 50) {
        status = "ocioso";
        hint = `Célula opera a ${eff.toFixed(0)}%. Realocar OPs para esta célula ou rever previsão.`;
      } else if (eff < 80) {
        status = "abaixo";
        hint = `Eficiência ${eff.toFixed(0)}%. Investigar paradas, retrabalho ou desbalanceamento.`;
      } else {
        status = "ok";
        hint = `Operando ${eff.toFixed(0)}% — saudável.`;
      }

      cells.push({
        supplierId: sid,
        supplierName: supName.get(sid) ?? "Sem nome",
        declaredPerDay,
        observedPerDay: Math.round(observedPerDay * 10) / 10,
        efficiencyPct: Math.round(eff),
        windowDays: WINDOW,
        totalProduced: total,
        status,
        hint,
      });
    });

    cells.sort((a, b) => a.efficiencyPct - b.efficiencyPct);

    const insights: string[] = [];
    const ocioso = cells.filter((c) => c.status === "ocioso").length;
    const abaixo = cells.filter((c) => c.status === "abaixo").length;
    const sem = cells.filter((c) => c.status === "sem_capacidade").length;
    if (ocioso > 0)
      insights.push(
        `${ocioso} célula(s) ociosa(s) — capacidade declarada está acima da produção real. Rebalancear ou rever meta.`,
      );
    if (abaixo > 0)
      insights.push(
        `${abaixo} célula(s) abaixo da meta — risco de atraso de OP. Acionar PCP para apoio.`,
      );
    if (sem > 0)
      insights.push(
        `${sem} fornecedor(es) sem capacidade declarada — cadastrar para diagnóstico completo.`,
      );
    if (insights.length === 0 && cells.length > 0)
      insights.push("Todas as células operam dentro da faixa saudável (≥80%).");

    return { windowDays: WINDOW, cells, insights };
  });
