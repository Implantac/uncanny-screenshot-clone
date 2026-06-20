import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

const SYSTEM = `Você é um agente operacional do USE MODA OS. Execute a tarefa em português brasileiro, em markdown, no máximo 8 linhas, terminando com **Próxima ação** (1–3 bullets).`;

function nextRunFromCron(cron: string | null): Date | null {
  if (!cron) return null;
  const m = cron.trim().match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (m) {
    const mins = Math.max(1, Math.min(1440, parseInt(m[1], 10)));
    return new Date(Date.now() + mins * 60_000);
  }
  // Fallback: rodar de novo daqui a 1h
  return new Date(Date.now() + 60 * 60_000);
}

export const Route = createFileRoute("/api/public/agents/run-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticate caller: aceitar apikey (padrão pg_cron) OU x-cron-secret (legado).
        const { timingSafeEqual } = await import("crypto");
        const safeEq = (a: string, b: string) => {
          if (!a || !b) return false;
          const ba = Buffer.from(a);
          const bb = Buffer.from(b);
          return ba.length === bb.length && timingSafeEqual(ba, bb);
        };
        const apiKey = request.headers.get("apikey") ?? "";
        const cronSecret = request.headers.get("x-cron-secret") ?? "";
        const expectedApi = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const expectedCron = process.env.CRON_SECRET ?? "";
        const authed = safeEq(apiKey, expectedApi) || safeEq(cronSecret, expectedCron);
        if (!authed) return new Response("Unauthorized", { status: 401 });

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: due, error } = await supabaseAdmin
          .from("ai_agents")
          .select("id, name, description, executions, success_rate, owner_id")
          .eq("status", "ativo")
          .not("schedule_cron", "is", null)
          .lte("next_run_at", new Date().toISOString())
          .limit(20);

        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!due || due.length === 0) return Response.json({ ran: 0 });

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");

        let okCount = 0;
        for (const agent of due) {
          let output = "";
          let ok = true;
          try {
            const res = await generateText({
              model,
              system: SYSTEM,
              prompt: `## Agente\nNome: ${agent.name}\nTarefa: ${agent.description ?? "(sem descrição)"}\n\nExecute agora.`,
              temperature: 0.4,
            });
            output = res.text;
            okCount++;
          } catch (e: any) {
            ok = false;
            output = `Falha: ${e?.message ?? "erro"}`;
          }

          const { data: full } = await supabaseAdmin
            .from("ai_agents")
            .select("executions, success_rate, schedule_cron")
            .eq("id", agent.id)
            .single();
          const prevExec = full?.executions ?? 0;
          const prevRate = Number(full?.success_rate ?? 0);
          const nextExec = prevExec + 1;
          const successes = (prevRate / 100) * prevExec + (ok ? 1 : 0);
          const nextRate = Math.round((successes / nextExec) * 1000) / 10;
          const next = nextRunFromCron(full?.schedule_cron ?? null);

          await supabaseAdmin
            .from("ai_agents")
            .update({
              last_output: output,
              last_run_at: new Date().toISOString(),
              executions: nextExec,
              success_rate: nextRate,
              next_run_at: next?.toISOString() ?? null,
            })
            .eq("id", agent.id);

          await supabaseAdmin.from("audit_logs").insert({
            user_id: agent.owner_id,
            entity: "ai_agents",
            entity_id: agent.id,
            action: ok ? "scheduled_run" : "scheduled_run_failed",
            payload: { name: agent.name },
          });
        }

        return Response.json({ ran: due.length, ok: okCount });
      },
    },
  },
});
