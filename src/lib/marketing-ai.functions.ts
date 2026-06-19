import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const SYSTEM = `Você é um estrategista sênior de marketing de moda no Brasil.
Receba um produto e uma região e gere uma estratégia de marketing **acionável, específica e baseada nos números fornecidos**.
Responda em **português brasileiro**, em **markdown**, no formato exato:

**Diagnóstico** (2 linhas com os números do contexto)
**Público-alvo** (1 linha — persona + faixa etária)
**Canais recomendados** (lista de 3, com %% sugerido do budget)
**Criativo & mensagem** (1 linha de tom + 1 gancho pronto para usar)
**Ofertas** (1 linha — preço/desconto/bundle)
**KPI alvo (30d)** (ROAS, CPA e meta de unidades)

Seja direto. Sem disclaimers. Máximo 12 linhas.`;

const Input = z.object({
  product: z.string().min(1).max(200),
  region: z.string().min(1).max(80),
  units: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  topChannel: z.string().max(80).optional(),
});

export const recommendStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `## Produto
${data.product}

## Região
${data.region}

## Performance recente
- Unidades vendidas: ${data.units}
- Receita: R$ ${data.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Canal de venda dominante: ${data.topChannel ?? "n/d"}

Gere a estratégia agora.`;

    const res = await generateText({ model, system: SYSTEM, prompt, temperature: 0.6 });
    return { text: res.text };
  });
