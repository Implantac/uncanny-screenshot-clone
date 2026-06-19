import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({
  brief: z.string().trim().min(3).max(800),
  season: z.string().trim().max(40).optional(),
  category: z.string().trim().max(40).optional(),
});

export type DesignerSuggestion = {
  mood: string;
  palette: Array<{ name: string; hex: string; usage: string }>;
  fabrics: Array<{ name: string; composition: string; why: string }>;
  refs: string[];
};

const SYSTEM = `Você é um designer de moda sênior e diretor criativo.
Receba um briefing curto e devolva APENAS JSON válido neste schema:
{
  "mood": "frase curta sobre o conceito",
  "palette": [{"name":"...","hex":"#RRGGBB","usage":"protagonista|apoio|destaque"}],
  "fabrics": [{"name":"...","composition":"...","why":"..."}],
  "refs": ["palavra-chave 1","palavra-chave 2"]
}
Regras: 4-6 cores coerentes (hex válido), 3-5 tecidos com composição real, 3-6 keywords. Sem texto fora do JSON.`;

function extractJson(s: string): any | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export const suggestPaletteFabric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => Input.parse(data))
  .handler(async ({ data }): Promise<DesignerSuggestion> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Briefing: ${data.brief}
${data.season ? `Estação: ${data.season}` : ""}
${data.category ? `Categoria: ${data.category}` : ""}

Devolva o JSON conforme o schema.`;

    try {
      const res = await generateText({ model, system: SYSTEM, prompt, temperature: 0.7 });
      const parsed = extractJson(res.text);
      if (!parsed) throw new Error("Resposta inválida da IA");
      return {
        mood: String(parsed.mood ?? ""),
        palette: Array.isArray(parsed.palette)
          ? parsed.palette.slice(0, 6).map((p: any) => ({
              name: String(p.name ?? ""),
              hex: /^#[0-9a-f]{6}$/i.test(p.hex ?? "") ? p.hex : "#888888",
              usage: String(p.usage ?? "apoio"),
            }))
          : [],
        fabrics: Array.isArray(parsed.fabrics)
          ? parsed.fabrics.slice(0, 5).map((f: any) => ({
              name: String(f.name ?? ""),
              composition: String(f.composition ?? ""),
              why: String(f.why ?? ""),
            }))
          : [],
        refs: Array.isArray(parsed.refs) ? parsed.refs.slice(0, 6).map(String) : [],
      };
    } catch (err: any) {
      const status = err?.statusCode ?? err?.lastError?.statusCode;
      if (status === 429)
        throw new Error("Limite de requisições da IA atingido. Aguarde alguns segundos.");
      if (status === 402)
        throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw err;
    }
  });
