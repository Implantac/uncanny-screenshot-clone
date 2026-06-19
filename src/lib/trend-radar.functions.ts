import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({
  horizon: z.enum(["now", "next-season", "next-year"]).default("next-season"),
  notes: z.string().trim().max(400).optional(),
});

export type TrendSignal = {
  title: string;
  summary: string;
  keywords: string[];
  colors: string[];
  category: string;
  relevance: number; // 0-100
  why: string;
};

const SYSTEM = `Você é um analista de tendências de moda sênior.
Receberá o contexto da marca (categorias mais usadas, paleta atual) + horizonte.
Devolva APENAS JSON neste schema:
{
  "signals": [
    {
      "title": "nome curto da tendência",
      "summary": "1 frase sobre o movimento",
      "keywords": ["...","..."],
      "colors": ["#RRGGBB","#RRGGBB"],
      "category": "categoria principal (ex.: Alfaiataria, Beachwear, Streetwear)",
      "relevance": 0-100,
      "why": "por que essa tendência faz sentido para ESTA marca, em 1 frase"
    }
  ]
}
Regras: 5-7 sinais. relevance reflete encaixe com a marca (paleta + categorias + horizonte). Sem texto fora do JSON.`;

function extractJson(s: string): any | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export const scanTrendRadar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => Input.parse(data))
  .handler(async ({ data, context }): Promise<{ signals: TrendSignal[]; brandContext: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { data: products = [] } = await context.supabase
      .from("products")
      .select("category, colors")
      .limit(500);

    const catMap = new Map<string, number>();
    const colorMap = new Map<string, number>();
    (products ?? []).forEach((p: any) => {
      if (p.category) catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1);
      (p.colors ?? []).forEach((c: string) => colorMap.set(c, (colorMap.get(c) ?? 0) + 1));
    });
    const topCats = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([c]) => c);
    const topColors = [...colorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c);

    const brandContext = `Categorias principais: ${topCats.join(", ") || "—"}
Paleta atual: ${topColors.join(", ") || "—"}
Horizonte: ${data.horizon}
${data.notes ? `Observações: ${data.notes}` : ""}`;

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const res = await generateText({
        model,
        system: SYSTEM,
        prompt: `# Contexto da marca\n${brandContext}\n\nGere os sinais agora.`,
        temperature: 0.7,
      });
      const parsed = extractJson(res.text);
      const arr = Array.isArray(parsed?.signals) ? parsed.signals : [];
      const signals: TrendSignal[] = arr
        .slice(0, 8)
        .map((s: any) => ({
          title: String(s.title ?? ""),
          summary: String(s.summary ?? ""),
          keywords: Array.isArray(s.keywords) ? s.keywords.slice(0, 6).map(String) : [],
          colors: Array.isArray(s.colors)
            ? s.colors.filter((c: any) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5)
            : [],
          category: String(s.category ?? ""),
          relevance: Math.max(0, Math.min(100, Math.round(Number(s.relevance ?? 0)))),
          why: String(s.why ?? ""),
        }))
        .sort((a: TrendSignal, b: TrendSignal) => b.relevance - a.relevance);

      return { signals, brandContext };
    } catch (err: any) {
      const status = err?.statusCode ?? err?.lastError?.statusCode;
      if (status === 429)
        throw new Error("Limite de requisições da IA atingido. Aguarde alguns segundos.");
      if (status === 402)
        throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw err;
    }
  });
