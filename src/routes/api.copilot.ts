import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o **Copiloto PCP** do USE MODA OS — especialista em planejamento, controle de produção, suprimentos e qualidade para indústria da moda.

## Sua função
Responder perguntas operacionais usando **tools** que consultam os dados reais do usuário. **Sempre** consulte as tools antes de responder. Nunca invente OPs, SKUs, fornecedores ou números.

## Tools disponíveis
- \`listLateOps\`: OPs atrasadas (due_date < hoje, status ativo).
- \`listAtRiskOps\`: OPs em risco (paradas no estágio há muito tempo, próximas do prazo).
- \`listMaterialShortages\`: Insumos abaixo do mínimo / cobertura crítica.
- \`listCriticalOccurrences\`: Ocorrências severas abertas na produção.
- \`listSupplierIssues\`: Fornecedores com mais ocorrências recentes.
- \`mrpCriticalItems\`: Itens MRP em status crítico (saldo ≤ ponto de pedido).
- \`mrpBuySuggestions\`: Sugestões de compra calculadas pelo MRP (LEC + déficit).
- \`mrpCapitalParado\`: Itens com excesso de estoque ou cobertura > 120 dias.
- \`mrpSupplierLeadtime\`: Lead time médio por fornecedor.

## Regras
1. Antes de responder qualquer pergunta sobre atrasos, riscos, faltas, fornecedores, ocorrências, MRP, compras ou estoque, chame a tool relevante.
2. Cite **códigos reais** (OP, SKU, nome do fornecedor) e números (dias de atraso, saldo, LEC, R$).
3. Seja conciso e acionável. Liste no máx 5 itens. Use markdown.
4. Quando a tool retornar lista vazia, diga claramente "sem registros" — não invente.
5. Sempre em português brasileiro.`;

function buildUserSupabase(token: string): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function buildTools(supabase: SupabaseClient, userId: string) {
  return {
    listLateOps: tool({
      description: "Lista ordens de produção atrasadas (due_date passou e status ainda ativo).",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
      execute: async ({ limit }) => {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("production_orders")
          .select("code, stage, status, due_date, quantity, supplier_id, suppliers:supplier_id(name), products:product_id(name,sku)")
          .eq("owner_id", userId)
          .in("status", ["aberta", "em_producao", "em_andamento", "iniciada"])
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(limit);
        if (error) return { error: error.message, items: [] };
        const items = (data ?? []).map((o: any) => {
          const days = Math.floor((Date.now() - new Date(o.due_date).getTime()) / 86400000);
          return {
            op: o.code,
            sku: o.products?.sku ?? null,
            produto: o.products?.name ?? null,
            estagio: o.stage,
            fornecedor: o.suppliers?.name ?? null,
            qtd: o.quantity,
            dias_atraso: days,
            due_date: o.due_date,
          };
        });
        return { count: items.length, items };
      },
    }),
    listAtRiskOps: tool({
      description: "Lista OPs em risco: paradas no estágio há >7 dias ou com due_date nos próximos 7 dias e ainda não finalizadas.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
      execute: async ({ limit }) => {
        const { data, error } = await supabase
          .from("production_orders")
          .select("code, stage, status, due_date, stage_updated_at, suppliers:supplier_id(name), products:product_id(name,sku)")
          .eq("owner_id", userId)
          .in("status", ["aberta", "em_producao", "em_andamento", "iniciada"])
          .order("stage_updated_at", { ascending: true, nullsFirst: true })
          .limit(100);
        if (error) return { error: error.message, items: [] };
        const now = Date.now();
        const ranked = (data ?? [])
          .map((o: any) => {
            const stuck = o.stage_updated_at
              ? Math.floor((now - new Date(o.stage_updated_at).getTime()) / 86400000)
              : 0;
            const daysToDue = o.due_date
              ? Math.floor((new Date(o.due_date).getTime() - now) / 86400000)
              : 999;
            const risk = stuck > 7 || (daysToDue <= 7 && daysToDue >= 0);
            return risk
              ? {
                  op: o.code,
                  sku: o.products?.sku ?? null,
                  produto: o.products?.name ?? null,
                  estagio: o.stage,
                  fornecedor: o.suppliers?.name ?? null,
                  dias_parado: stuck,
                  dias_ate_prazo: daysToDue,
                  motivo: stuck > 7 ? "parado_muito_tempo" : "prazo_iminente",
                }
              : null;
          })
          .filter(Boolean)
          .slice(0, limit);
        return { count: ranked.length, items: ranked };
      },
    }),
    listMaterialShortages: tool({
      description: "Lista insumos do almoxarifado abaixo do estoque mínimo.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
      execute: async ({ limit }) => {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("sku, name, unit, balance, minimum, category")
          .eq("owner_id", userId)
          .limit(500);
        if (error) return { error: error.message, items: [] };
        const items = (data ?? [])
          .filter((i: any) => Number(i.balance ?? 0) < Number(i.minimum ?? 0))
          .map((i: any) => ({
            sku: i.sku,
            nome: i.name,
            categoria: i.category,
            unidade: i.unit,
            saldo: Number(i.balance ?? 0),
            minimo: Number(i.minimum ?? 0),
            faltam: Math.max(0, Number(i.minimum ?? 0) - Number(i.balance ?? 0)),
          }))
          .sort((a, b) => b.faltam - a.faltam)
          .slice(0, limit);
        return { count: items.length, items };
      },
    }),
    listCriticalOccurrences: tool({
      description: "Lista ocorrências críticas/abertas na produção dos últimos 30 dias.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
      execute: async ({ limit }) => {
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const { data, error } = await supabase
          .from("production_occurrences")
          .select("id, occurrence_type, severity, description, status, created_at, production_order_id, production_orders:production_order_id(code)")
          .eq("owner_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return { error: error.message, items: [] };
        const items = (data ?? [])
          .filter((o: any) => o.severity === "critical" || o.status === "open" || o.status === "aberta")
          .slice(0, limit)
          .map((o: any) => ({
            op: o.production_orders?.code ?? null,
            tipo: o.occurrence_type,
            severidade: o.severity,
            status: o.status,
            descricao: o.description,
            data: o.created_at,
          }));
        return { count: items.length, items };
      },
    }),
    listSupplierIssues: tool({
      description: "Lista fornecedores com mais ocorrências nos últimos 60 dias.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(10).default(5) }),
      execute: async ({ limit }) => {
        const since = new Date(Date.now() - 60 * 86400_000).toISOString();
        const { data: occs, error } = await supabase
          .from("production_occurrences")
          .select("severity, production_orders:production_order_id(supplier_id, suppliers:supplier_id(name))")
          .eq("owner_id", userId)
          .gte("created_at", since)
          .limit(500);
        if (error) return { error: error.message, items: [] };
        const tally = new Map<string, { name: string; total: number; criticas: number }>();
        for (const o of occs ?? []) {
          const sid = (o as any).production_orders?.supplier_id;
          const sname = (o as any).production_orders?.suppliers?.name;
          if (!sid || !sname) continue;
          const cur = tally.get(sid) ?? { name: sname, total: 0, criticas: 0 };
          cur.total += 1;
          if ((o as any).severity === "critical") cur.criticas += 1;
          tally.set(sid, cur);
        }
        const items = Array.from(tally.values())
          .sort((a, b) => b.criticas - a.criticas || b.total - a.total)
          .slice(0, limit)
          .map((s) => ({ fornecedor: s.name, ocorrencias: s.total, criticas: s.criticas }));
        return { count: items.length, items };
      },
    }),
  };
}

export const Route = createFileRoute("/api/copilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabasePub = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabasePub) return new Response("Server misconfigured", { status: 500 });

        const authClient = createClient(supabaseUrl, supabasePub, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub;

        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages) || body.messages.length === 0)
          return new Response("Messages required", { status: 400 });
        if (body.messages.length > 50) return new Response("Too many messages", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const userSupabase = buildUserSupabase(token);
        const tools = buildTools(userSupabase, userId);

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
