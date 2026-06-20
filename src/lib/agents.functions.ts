import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const SYSTEM = `Você é um agente operacional do USE MODA OS (PLM + ERP Fashion).
Execute a tarefa descrita pelo agente abaixo e produza um relatório acionável em **português brasileiro**, em markdown, com no máximo 8 linhas. Use números reais quando recebidos no contexto. Termine com uma seção **Próxima ação** com 1–3 bullets.`;

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ agentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: agent, error } = await supabase
      .from("ai_agents")
      .select("id, name, description, executions, success_rate, owner_id")
      .eq("id", data.agentId)
      .eq("owner_id", userId)
      .single();
    if (error || !agent) throw new Error("Agente não encontrado");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // Light context: counts only, to keep prompt small and avoid leaking PII.
    const [{ count: produtos }, { count: ordens }, { count: vendas }] = await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("production_orders").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("sales").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const prompt = `## Agente
Nome: ${agent.name}
Tarefa: ${agent.description ?? "(sem descrição)"}

## Contexto do tenant
- Produtos cadastrados: ${produtos ?? 0}
- Ordens de produção: ${ordens ?? 0}
- Vendas registradas: ${vendas ?? 0}

Execute a tarefa do agente agora.`;

    let output = "";
    let ok = true;
    try {
      const res = await generateText({ model, system: SYSTEM, prompt, temperature: 0.4 });
      output = res.text;
    } catch (e) {
      ok = false;
      output = `Falha na execução: ${e instanceof Error ? e.message : "erro desconhecido"}`;
    }

    const prevExec = agent.executions ?? 0;
    const prevRate = Number(agent.success_rate ?? 0);
    const nextExec = prevExec + 1;
    const successes = (prevRate / 100) * prevExec + (ok ? 1 : 0);
    const nextRate = Math.round((successes / nextExec) * 1000) / 10;

    await supabase
      .from("ai_agents")
      .update({
        last_output: output,
        last_run_at: new Date().toISOString(),
        executions: nextExec,
        success_rate: nextRate,
      })
      .eq("id", agent.id);

    await supabase.rpc("log_audit", {
      _entity: "ai_agents",
      _entity_id: agent.id,
      _action: ok ? "run" : "run_failed",
      _payload: { name: agent.name },
    });
    void userId;

    return { ok, output };
  });
