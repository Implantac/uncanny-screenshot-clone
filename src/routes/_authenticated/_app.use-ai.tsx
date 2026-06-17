import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Play, Pause, Plus, Activity, Loader2, Sparkles, MessageCircleQuestion } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { runAgent } from "@/lib/agents.functions";
import { Markdown } from "@/components/markdown";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

type Persona = "development" | "pcp" | "marketing";
const CHIPS: { label: string; persona: Persona; question: string }[] = [
  // Perguntas-chave do prompt mestre (análise, não chat genérico)
  { label: "Qual coleção vendeu mais?", persona: "marketing", question: "Qual coleção vendeu mais nos últimos 90 dias? Mostre faturamento, ticket médio e top 3 produtos dela." },
  { label: "Qual produto tem maior margem?", persona: "marketing", question: "Quais são os 5 produtos com maior margem de contribuição hoje? Inclua categoria e coleção de origem." },
  { label: "Qual lote está atrasado?", persona: "pcp", question: "Quais lotes de produção estão atrasados ou com risco real de atraso? Para cada um, indique o setor que está segurando e a ação imediata." },
  { label: "Qual produto repetir?", persona: "marketing", question: "Quais produtos do meu histórico devo repetir na próxima coleção? Use sell-through, margem e velocidade de giro como critério." },
  { label: "Qual coleção deu prejuízo?", persona: "marketing", question: "Alguma coleção encerrou no vermelho (custo > faturamento)? Liste, com investimento, faturamento e o que aprender para a próxima." },
  // Perguntas operacionais
  { label: "Top 3 gargalos do PCP hoje", persona: "pcp", question: "Quais são os 3 maiores gargalos do PCP hoje, por setor, e a ação imediata para cada um?" },
  { label: "Quais protótipos estão travando coleção?", persona: "development", question: "Quais protótipos estão travados há mais tempo e como destravar cada um?" },
  { label: "Onde investir em marketing nesta semana?", persona: "marketing", question: "Onde devo investir em marketing nesta semana? Liste 3 ações com retorno esperado." },
  { label: "Top produtos sub-aproveitados", persona: "marketing", question: "Quais produtos do meu acervo estão sub-aproveitados (vendas vs estoque) e como impulsionar?" },
  { label: "O que aprovar primeiro hoje?", persona: "development", question: "Liste em ordem o que devo aprovar/decidir primeiro hoje no desenvolvimento, com justificativa." },
  { label: "Influenciadores com melhor ROI", persona: "marketing", question: "Quais influenciadores trouxeram melhor ROI e quais devo repetir/cortar?" },
  { label: "Risco de não bater a meta do mês", persona: "pcp", question: "Vou bater a meta de produção do mês? Onde estão os riscos e como mitigar?" },
];



export const Route = createFileRoute("/_authenticated/_app/use-ai")({
  head: () => ({
    meta: [
      { title: "USE AI · USE MODA OS" },
      { name: "description", content: "Agentes de IA para automação de processos de moda." },
    ],
  }),
  component: UseAI,
});

function relTime(iso: string | null) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `há ${Math.floor(diff)}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} dias`;
}

function UseAI() {
  useRealtime("ai_agents", ["ai-agents"]);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [ask, setAsk] = useState<{ persona: Persona; question: string } | null>(null);
  const { data, isLoading } = useQuery({

    queryKey: ["ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (a: { id: string; status: string }) => {
      const next = a.status === "ativo" ? "pausado" : "ativo";
      const { error } = await supabase.from("ai_agents").update({ status: next, last_run_at: next === "ativo" ? new Date().toISOString() : undefined }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      const name = window.prompt("Nome do agente:");
      if (!name) return;
      const description = window.prompt("Descrição:") ?? "";
      const { error } = await supabase.from("ai_agents").insert({ owner_id: user.id, name, description, status: "ativo", executions: 0, success_rate: 0 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-agents"] }); toast.success("Agente criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const runFn = useServerFn(runAgent);
  const run = useMutation({
    mutationFn: async (id: string) => runFn({ data: { agentId: id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success(r.ok ? "Agente executado" : "Execução com falha");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao executar"),
  });

  const agentes = data ?? [];
  const ativos = agentes.filter((a) => a.status === "ativo").length;
  const totalExec = agentes.reduce((s, a) => s + (a.executions ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Cpu className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">USE AI</h1>
            <p className="text-sm text-muted-foreground">{ativos} agentes ativos · {totalExec.toLocaleString("pt-BR")} execuções</p>
          </div>
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="h-9 px-4 rounded-md text-sm font-medium bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] inline-flex items-center gap-2 disabled:opacity-60">
          <Plus className="size-4" /> Novo agente
        </button>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircleQuestion className="size-4 text-primary" /> Pergunte ao USE AI
        </div>
        <ProactiveSuggestions onAsk={(q) => setAsk(q)} active={ask?.question} all={CHIPS} />
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onClick={() => setAsk({ persona: c.persona, question: c.question })}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${ask?.question === c.question ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-muted"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {ask && (
          <AICoordinatorPanel
            key={ask.question}
            persona={ask.persona}
            question={ask.question}
            title={ask.question}
          />
        )}
      </div>



      {isLoading ? (
        <div className="glass rounded-xl p-12 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : agentes.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">Nenhum agente cadastrado. Crie o primeiro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentes.map((a) => (
            <div key={a.id} className="glass rounded-xl p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${a.status === "ativo" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {a.status === "ativo" ? <Activity className="size-5" /> : <Pause className="size-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.description}</div>
                  </div>
                </div>
                <button onClick={() => toggle.mutate({ id: a.id, status: a.status })} className="size-8 rounded-md bg-muted hover:bg-muted/70 grid place-items-center text-muted-foreground shrink-0">
                  {a.status === "ativo" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border text-xs">
                <div>
                  <div className="text-muted-foreground">Execuções</div>
                  <div className="font-medium tabular-nums mt-0.5">{(a.executions ?? 0).toLocaleString("pt-BR")}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Sucesso</div>
                  <div className="font-medium tabular-nums mt-0.5">{a.status === "ativo" ? `${Number(a.success_rate ?? 0).toFixed(0)}%` : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Última</div>
                  <div className="font-medium mt-0.5">{relTime(a.last_run_at)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={async () => {
                    const cur = a.schedule_cron ?? "";
                    const v = window.prompt("Expressão cron (ex: */30 * * * *) — vazio para desativar:", cur);
                    if (v === null) return;
                    const cron = v.trim() || null;
                    const next = cron ? new Date(Date.now() + 60_000).toISOString() : null;
                    const { error } = await supabase.from("ai_agents").update({ schedule_cron: cron, next_run_at: next }).eq("id", a.id);
                    if (error) toast.error(error.message);
                    else { toast.success(cron ? "Agendado" : "Agendamento removido"); qc.invalidateQueries({ queryKey: ["ai-agents"] }); }
                  }}
                  className="h-8 px-3 rounded-md text-xs border border-border hover:bg-accent inline-flex items-center gap-1.5"
                >
                  {a.schedule_cron ? `⏱ ${a.schedule_cron}` : "Agendar"}
                </button>
                <button
                  onClick={() => run.mutate(a.id)}
                  disabled={run.isPending && run.variables === a.id}
                  className="h-8 px-3 rounded-md text-xs font-medium bg-[image:var(--gradient-primary)] text-primary-foreground inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {run.isPending && run.variables === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Executar agora
                </button>
              </div>
              {a.last_output && (
                <div className="mt-3 pt-3 border-t border-border text-xs glass rounded-lg p-3 max-h-48 overflow-y-auto">
                  <Markdown content={a.last_output} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
