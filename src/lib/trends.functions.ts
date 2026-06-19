import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().regex(/^data:image\/(jpeg|png|webp|jpg);base64,/, "Imagem inválida"),
});

type Analysis = {
  categoria: string;
  estilo: string;
  cores: string[];
  tecidos: string[];
  tendencias: string[];
  descricao: string;
};

export const analyzeTrendImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<Analysis> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em moda. Analise a imagem e retorne APENAS um JSON válido com as chaves: categoria (string), estilo (string), cores (array de hex), tecidos (array), tendencias (array), descricao (string curta em português).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analise esta peça/referência de moda." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429)
        throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402)
        throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
      throw new Error(`AI Gateway: ${res.status} ${err.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta da IA sem JSON detectável.");
    const parsed = JSON.parse(match[0]);
    return {
      categoria: String(parsed.categoria ?? ""),
      estilo: String(parsed.estilo ?? ""),
      cores: Array.isArray(parsed.cores) ? parsed.cores.map(String) : [],
      tecidos: Array.isArray(parsed.tecidos) ? parsed.tecidos.map(String) : [],
      tendencias: Array.isArray(parsed.tendencias) ? parsed.tendencias.map(String) : [],
      descricao: String(parsed.descricao ?? ""),
    };
  });
