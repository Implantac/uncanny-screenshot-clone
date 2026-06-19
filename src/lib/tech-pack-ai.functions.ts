import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const SYSTEM = `Você é um(a) engenheiro(a) de produto de moda sênior.
Receba uma ficha técnica (BOM + operações) e produza um relatório em **português brasileiro**, em markdown, com no máximo 12 linhas, no formato:

**Diagnóstico de custo** (1 linha — % materiais vs mão de obra)
**Otimizações de BOM** (até 3 bullets — material, ação, ganho estimado em R$)
**Otimizações de operação** (até 3 bullets — operação, ação, ganho em SAM ou R$)
**Sustentabilidade** (1 linha — substituição sugerida + impacto)
**Risco** (1 linha — o que validar antes de aplicar)

Use os números do contexto. Sem disclaimers.`;

export const suggestTechSheetImprovements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ techSheetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const [{ data: sheet }, { data: mats }, { data: ops }] = await Promise.all([
      supabase
        .from("tech_sheets")
        .select("id, code, materials_cost, labor_cost, cost_price, overhead_pct")
        .eq("id", data.techSheetId)
        .single(),
      supabase
        .from("tech_sheet_materials")
        .select("description, consumption, unit, waste_pct, unit_cost, total_cost")
        .eq("tech_sheet_id", data.techSheetId),
      supabase
        .from("tech_sheet_operations")
        .select("description, sam_minutes, machine, unit_cost, total_cost")
        .eq("tech_sheet_id", data.techSheetId),
    ]);
    if (!sheet) throw new Error("Ficha não encontrada");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const prompt = `## Ficha ${sheet.code}
Materiais: R$ ${Number(sheet.materials_cost ?? 0).toFixed(2)}
Mão de obra: R$ ${Number(sheet.labor_cost ?? 0).toFixed(2)}
Overhead: ${Number(sheet.overhead_pct ?? 0)}%
Custo final: R$ ${Number(sheet.cost_price ?? 0).toFixed(2)}

## BOM
${
  (mats ?? [])
    .map(
      (m: any) =>
        `- ${m.description}: ${m.consumption}${m.unit ?? ""} × R$${m.unit_cost} (perda ${m.waste_pct ?? 0}%) = R$${m.total_cost}`,
    )
    .join("\n") || "(vazio)"
}

## Operações
${
  (ops ?? [])
    .map(
      (o: any) =>
        `- ${o.description}: ${o.sam_minutes ?? 0}min ${o.machine ?? ""} = R$${o.total_cost}`,
    )
    .join("\n") || "(vazio)"
}

Gere o relatório agora.`;

    const res = await generateText({
      model,
      system: SYSTEM,
      prompt,
      temperature: 0.5,
    });
    return { text: res.text };
  });
