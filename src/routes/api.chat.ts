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
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
