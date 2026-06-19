import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o **Fashion GPT**, copiloto de IA do USE MODA OS — Fashion Operating System (PLM + ERP Fashion + PCP + Supply Chain + BI + IA) para a indústria da moda brasileira.

## Papel
Apoiar gestores, designers, compradores, PCP e comercial em decisões operacionais e estratégicas, **sempre baseado nos dados reais do contexto JSON** fornecido.

## Domínios que você cobre
- **Produtos & Coleções** — grupo, subgrupo, classe, grade, cor, margem, status
- **Produção (M36/M42/M43/M44)** — necessidade, kanban PCP, centro de corte, digital twin
- **Reposição (M37)** — sugestão por giro/cobertura/sazonalidade
- **Vendas & Geo (M38/M41)** — performance por UF, canal, atribuição
- **Influencers (M39/M40)** — cadastro, ROI antes×depois
- **Product Score (M47/M48)** — probabilidade de sucesso, score 0–100
- **Estoque, Financeiro, Marketing, Fornecedores, ESG/DPP**

## Regras de resposta
1. **Use números reais** do contexto sempre que possível (cite SKU, valor, %).
2. Se a pergunta for sobre "o que produzir / repor", calcule pela cobertura: cobertura(dias) = estoque / (vendas30d/30). <15 dias = vermelho, 15–30 = amarelo, >30 = verde.
3. ROI de influencer = ((vendas_depois − vendas_antes) / vendas_antes) × 100.
4. Seja **conciso e acionável**. Liste no máximo 5 itens por bloco. Use markdown (negrito, listas, tabelas curtas).
5. Quando faltar dado no contexto, diga claramente "não há dado suficiente" em vez de inventar.
6. Responda **sempre em português brasileiro**.`;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8000;
const MAX_CONTEXT_CHARS = 50000;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth check — protect AI credits from unauthenticated abuse
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabasePublishableKey) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabasePublishableKey, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as { messages?: UIMessage[]; context?: unknown };
        const { messages, context } = body;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        if (messages.length === 0 || messages.length > MAX_MESSAGES) {
          return new Response("Invalid message count", { status: 400 });
        }
        // Size limits per message
        for (const m of messages) {
          const parts = (m as UIMessage).parts;
          const text = Array.isArray(parts)
            ? parts.map((p: any) => (p?.type === "text" ? (p.text ?? "") : "")).join("")
            : "";
          if (text.length > MAX_MESSAGE_CHARS) {
            return new Response("Message too large", { status: 413 });
          }
        }
        let contextBlock = "";
        if (context !== undefined && context !== null) {
          const serialized = JSON.stringify(context);
          if (serialized.length > MAX_CONTEXT_CHARS) {
            return new Response("Context too large", { status: 413 });
          }
          contextBlock = `\n\n## Contexto atual da operação (dados reais do usuário, formato JSON)\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\nUse esses dados sempre que a pergunta envolver produtos, pedidos, financeiro, estoque ou coleções. Cite números reais quando relevante.`;
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT + contextBlock,
          messages: await convertToModelMessages(messages),
          // Prevent protocol errors: the runtime must execute tool_calls and
          // append tool responses for each tool_call_id.
          // This endpoint doesn't implement tool execution, so tool calling must be disabled.
          tools: undefined,
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
