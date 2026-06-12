import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o **Fashion GPT**, assistente de IA especialista no USE MODA OS — um Fashion Operating System que unifica PLM, ERP Fashion, PCP, Supply Chain, BI e IA para a indústria da moda brasileira.

Você ajuda gestores, designers, compradores e produção a:
- Analisar coleções, produtos, margens, ciclos de desenvolvimento
- Sugerir tendências, paletas, tecidos e fornecedores
- Otimizar PCP, estoque (almoxarifado) e logística
- Interpretar KPIs comerciais, financeiros e de BI
- Apoiar ESG/DPP (Digital Product Passport) e rastreabilidade

Responda sempre em **português brasileiro**, com clareza e foco em ação. Use markdown (listas, negrito, tabelas curtas) quando ajudar a leitura. Seja conciso por padrão; aprofunde quando solicitado.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[]; context?: unknown };
        const { messages, context } = body;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const contextBlock = context
          ? `\n\n## Contexto atual da operação (dados reais do usuário, formato JSON)\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\nUse esses dados sempre que a pergunta envolver produtos, pedidos, financeiro, estoque ou coleções. Cite números reais quando relevante.`
          : "";

        const result = streamText({
          model,
          system: SYSTEM_PROMPT + contextBlock,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
