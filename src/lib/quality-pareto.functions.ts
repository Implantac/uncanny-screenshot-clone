import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Cause5M = "metodo" | "mao_de_obra" | "material" | "maquina" | "meio";

export type ParetoItem = {
  label: string;
  cause: Cause5M;
  count: number;
  cumulativePct: number;
  isVitalFew: boolean; // dentro dos 80%
};

export type FiveMBucket = {
  cause: Cause5M;
  label: string;
  count: number;
  pct: number;
  topExample: string;
};

export type ParetoAnalysis = {
  windowDays: number;
  total: number;
  pareto: ParetoItem[];
  fiveM: FiveMBucket[];
  insight: string;
};

const CAUSE_LABEL: Record<Cause5M, string> = {
  metodo: "Método",
  mao_de_obra: "Mão-de-obra",
  material: "Material",
  maquina: "Máquina",
  meio: "Meio",
};

// classificação heurística por palavras-chave em pt-BR
function classify(text: string): Cause5M {
  const t = text.toLowerCase();
  if (/(maquina|máquina|equipamento|calibra|agulha|motor|tens[aã]o|lâmina|lamina)/.test(t))
    return "maquina";
  if (/(tecido|fio|linha|aviamento|lote|fornecedor|mat[eé]ria|encolh|defeito de tecido)/.test(t))
    return "material";
  if (/(operador|costureir|treinamento|erro humano|distra|cansaco|cansaço|equipe)/.test(t))
    return "mao_de_obra";
  if (/(ambiente|umidade|temperatura|ilumina|ergonom|layout|fluxo|limpeza)/.test(t)) return "meio";
  return "metodo"; // default: ficha, processo, ordem, encaixe, costura
}

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

export const getParetoAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ParetoAnalysis> => {
    const sb = context.supabase;
    const WINDOW = 90;
    const since = new Date(Date.now() - WINDOW * 86400000).toISOString();

    const [{ data: occs }, { data: insps }] = await Promise.all([
      sb
        .from("production_occurrences")
        .select("kind, description, sector, created_at")
        .gte("created_at", since),
      sb
        .from("quality_inspections")
        .select("inspection_type, notes, result, inspected_at")
        .gte("inspected_at", since)
        .in("result", ["reprovado", "reprovada"]),
    ]);

    type Row = { label: string; cause: Cause5M; raw: string };
    const rows: Row[] = [];

    for (const o of (occs ?? []) as { kind: string; description: string | null }[]) {
      const raw = `${o.kind ?? ""} ${o.description ?? ""}`.trim();
      if (!raw) continue;
      rows.push({
        label: normalizeLabel(o.kind || o.description || "—"),
        cause: classify(raw),
        raw,
      });
    }
    for (const i of (insps ?? []) as { inspection_type: string; notes: string | null }[]) {
      const raw = `${i.inspection_type ?? ""} ${i.notes ?? ""}`.trim();
      if (!raw) continue;
      rows.push({
        label: normalizeLabel(i.inspection_type || i.notes || "—"),
        cause: classify(raw),
        raw,
      });
    }

    const total = rows.length;

    // Pareto agrupado por label
    const byLabel = new Map<string, { cause: Cause5M; count: number }>();
    for (const r of rows) {
      const a = byLabel.get(r.label) ?? { cause: r.cause, count: 0 };
      a.count += 1;
      byLabel.set(r.label, a);
    }
    const sorted = Array.from(byLabel.entries())
      .map(([label, v]) => ({ label, cause: v.cause, count: v.count }))
      .sort((a, b) => b.count - a.count);
    let cum = 0;
    const pareto: ParetoItem[] = sorted.slice(0, 15).map((s) => {
      cum += s.count;
      const cumulativePct = total ? (cum / total) * 100 : 0;
      return {
        label: s.label,
        cause: s.cause,
        count: s.count,
        cumulativePct,
        isVitalFew: cumulativePct <= 80,
      };
    });

    // 5M
    const fiveAgg = new Map<Cause5M, { count: number; topExample: string; topCount: number }>();
    for (const r of rows) {
      const a = fiveAgg.get(r.cause) ?? { count: 0, topExample: r.label, topCount: 0 };
      a.count += 1;
      const lblCount = byLabel.get(r.label)?.count ?? 0;
      if (lblCount > a.topCount) {
        a.topExample = r.label;
        a.topCount = lblCount;
      }
      fiveAgg.set(r.cause, a);
    }
    const fiveM: FiveMBucket[] = (
      ["metodo", "mao_de_obra", "material", "maquina", "meio"] as Cause5M[]
    ).map((c) => {
      const a = fiveAgg.get(c) ?? { count: 0, topExample: "—", topCount: 0 };
      return {
        cause: c,
        label: CAUSE_LABEL[c],
        count: a.count,
        pct: total ? (a.count / total) * 100 : 0,
        topExample: a.topExample,
      };
    });
    fiveM.sort((a, b) => b.count - a.count);

    let insight: string;
    if (total === 0) {
      insight = "Sem ocorrências/reprovações na janela — base limpa para acompanhar tendências.";
    } else {
      const dominant = fiveM[0];
      const vitalCount = pareto.filter((p) => p.isVitalFew).length;
      insight = `${dominant.label} concentra ${dominant.pct.toFixed(0)}% das causas (ex.: "${dominant.topExample}"). ${vitalCount} causa(s) explicam 80% — foco aqui resolve a maior parte.`;
    }

    return { windowDays: WINDOW, total, pareto, fiveM, insight };
  });
