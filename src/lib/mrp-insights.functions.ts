import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { runMrpPlanning, type MrpRow, type MrpSummary } from "@/lib/mrp-planning.functions";

export type Persona = "diretor" | "comprador" | "pcp" | "financeiro";

const PERSONA_PROMPT: Record<Persona, string> = {
  diretor:
    "Você é o Diretor Industrial. Foque em: saúde geral do estoque, capital empatado, riscos macro, oportunidades de economia, KPIs estratégicos. Linguagem executiva, números arredondados, decisões.",
  comprador:
    "Você é o Comprador. Foque em: o que comprar agora (priorizado por valor e urgência), consolidação por fornecedor, lead time, negociação, LEC vs lote prático. Liste ações concretas.",
  pcp:
    "Você é o PCP. Foque em: riscos de ruptura por material crítico para produção, cobertura vs OPs abertas, materiais que travam linhas. Aponte itens específicos e dias de cobertura.",
  financeiro:
    "Você é o Controller. Foque em: capital parado, giro, ROI do estoque, itens em excesso para liquidar, projeção de desembolso com compras sugeridas. Use R$ e percentuais.",
};

export type MrpExecKpis = {
  totalStockValue: number;
  capitalParado: number;
  capitalParadoPct: number;
  itemsCritical: number;
  itemsExcess: number;
  rupturas: number;
  avgCoverage: number | null;
  suggestedValue: number;
  suggestedItems: number;
  giroMedio: number;
  totalSkus: number;
  // top 5
  topCritical: { sku: string; name: string; coverage: number | null; suggested: number }[];
  topExcess: { sku: string; name: string; capital: number; coverage: number | null }[];
  topBuy: { sku: string; name: string; supplier: string | null; value: number }[];
  bySupplier: { name: string; items: number; capital: number; avgLeadTime: number }[];
};

function buildKpis(rows: MrpRow[], summary: MrpSummary): MrpExecKpis {
  const giro = rows.length
    ? rows.reduce((a, r) => a + r.turnover, 0) / rows.length
    : 0;

  const supMap = new Map<string, { name: string; items: number; capital: number; lt: number }>();
  for (const r of rows) {
    const k = r.supplierName ?? "(sem fornecedor)";
    const cur = supMap.get(k) ?? { name: k, items: 0, capital: 0, lt: 0 };
    cur.items += 1;
    cur.capital += r.capitalEmpatado;
    cur.lt += r.leadTimeDays;
    supMap.set(k, cur);
  }

  return {
    totalStockValue: summary.totalStockValue,
    capitalParado: summary.capitalParado,
    capitalParadoPct: summary.totalStockValue > 0
      ? (summary.capitalParado / summary.totalStockValue) * 100
      : 0,
    itemsCritical: summary.itemsCritical,
    itemsExcess: summary.itemsExcess,
    rupturas: summary.rupturas,
    avgCoverage: summary.avgCoverage,
    suggestedValue: summary.suggestedValue,
    suggestedItems: summary.suggestedItems,
    giroMedio: Number(giro.toFixed(2)),
    totalSkus: summary.totalSkus,
    topCritical: rows
      .filter((r) => r.status === "critico")
      .slice(0, 5)
      .map((r) => ({ sku: r.sku, name: r.name, coverage: r.coverageDays, suggested: r.suggestedPurchase })),
    topExcess: [...rows]
      .filter((r) => r.status === "excesso")
      .sort((a, b) => b.capitalEmpatado - a.capitalEmpatado)
      .slice(0, 5)
      .map((r) => ({ sku: r.sku, name: r.name, capital: r.capitalEmpatado, coverage: r.coverageDays })),
    topBuy: [...rows]
      .filter((r) => r.suggestedPurchase > 0)
      .sort((a, b) => b.suggestedValue - a.suggestedValue)
      .slice(0, 5)
      .map((r) => ({ sku: r.sku, name: r.name, supplier: r.supplierName, value: r.suggestedValue })),
    bySupplier: Array.from(supMap.values())
      .map((s) => ({ name: s.name, items: s.items, capital: Number(s.capital.toFixed(2)), avgLeadTime: Number((s.lt / s.items).toFixed(1)) }))
      .sort((a, b) => b.capital - a.capital)
      .slice(0, 8),
  };
}

export const getMrpExecKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MrpExecKpis> => {
    const { rows, summary } = await runMrpPlanning(context.supabase, context.userId);
    return buildKpis(rows, summary);
  });

export const generateMrpInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { persona: Persona }) =>
    z.object({ persona: z.enum(["diretor", "comprador", "pcp", "financeiro"]) }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ insights: string; kpis: MrpExecKpis }> => {
    const { rows, summary } = await runMrpPlanning(context.supabase, context.userId);
    const kpis = buildKpis(rows, summary);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const ctx = JSON.stringify(kpis);
    const sys = `Você é o Copiloto MRP do USE MODA PLM, especialista em planejamento de materiais para indústria da moda.

${PERSONA_PROMPT[data.persona]}

REGRAS:
- Responda SEMPRE em português brasileiro.
- Use markdown com seções curtas.
- Cite **SKUs reais** e **R$ reais** dos dados.
- Estruture: (1) Diagnóstico em 2 linhas, (2) 3-5 insights priorizados, (3) Ações recomendadas (lista numerada, no máx 5).
- Seja conciso, acionável, sem floreios.
- Se um valor é zero ou ausente, diga claramente — não invente.`;

    const { text } = await generateText({
      model,
      system: sys,
      prompt: `Analise os indicadores MRP atuais do meu estoque e gere insights:\n\n\`\`\`json\n${ctx}\n\`\`\``,
    });

    return { insights: text, kpis };
  });
