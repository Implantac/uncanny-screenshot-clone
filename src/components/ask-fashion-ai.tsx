import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Brain, Loader2, Sparkles, Send, PenTool, Factory, Megaphone, Wand2, CheckCircle2, PlayCircle } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { askInsight } from "@/lib/ai-insights.functions";
import { executeAICommand } from "@/lib/ai-commands.functions";
import { lookupCommandRefs } from "@/lib/ai-commands-lookup.functions";
import { toast } from "sonner";

type Persona = "development" | "pcp" | "marketing" | "command";

const PERSONAS: { id: Persona; label: string; icon: React.ReactNode; suggestions: string[] }[] = [
  {
    id: "development",
    label: "Desenvolvimento",
    icon: <PenTool className="size-4" />,
    suggestions: [
      "Quais pilotos estão aguardando aprovação?",
      "Quais produtos aprovados ainda não têm ficha técnica?",
      "Qual coleção está em risco de não fechar a tempo?",
      "Qual referência está demorando mais para ser desenvolvida?",
    ],
  },
  {
    id: "pcp",
    label: "PCP",
    icon: <Factory className="size-4" />,
    suggestions: [
      "Qual setor está sobrecarregado hoje?",
      "Qual é o gargalo da produção agora?",
      "Quais OPs estão paradas há mais de 5 dias?",
      "O que cada setor deve priorizar hoje?",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: <Megaphone className="size-4" />,
    suggestions: [
      "Em qual produto devo investir esta semana?",
      "Qual coleção teve melhor desempenho nos últimos 30 dias?",
      "Qual influenciador trouxe maior retorno?",
      "Qual canal gera maior ROI agora?",
    ],
  },
  {
    id: "command",
    label: "Comando",
    icon: <Wand2 className="size-4" />,
    suggestions: [
      "Criar OP de 200 peças do SKU <X> para o fornecedor <Y> com entrega dia <DD/MM>",
      "Abrir RFQ de malha algodão branca, 500m, entrega em 15 dias",
      "Acelerar a coleção em maior risco — me mostre o plano",
      "Bloquear fornecedor com mais ocorrências nos últimos 60 dias",
    ],
  },
];

type AIAction =
  | { kind: "create_rfq"; title: string; quantity: number; unit?: string | null; needed_by?: string | null; notes?: string | null }
  | { kind: "create_op"; sku: string; quantity: number; supplier_name?: string | null; due_date?: string | null; notes?: string | null }
  | { kind: "block_supplier"; supplier_name: string; reason?: string | null };

function parseAction(text: string): { action: AIAction | null; cleaned: string } {
  const re = /```json\s*([\s\S]*?)```/i;
  const match = text.match(re);
  if (!match) return { action: null, cleaned: text };
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed?.action?.kind) return { action: parsed.action as AIAction, cleaned: text.replace(re, "").trim() };
  } catch {}
  return { action: null, cleaned: text };
}

const ACTION_LABEL: Record<AIAction["kind"], string> = {
  create_rfq: "Criar RFQ",
  create_op: "Criar Ordem de Produção",
  block_supplier: "Bloquear fornecedor",
};

export function AskFashionAI() {
  const [persona, setPersona] = useState<Persona>("development");
  const [question, setQuestion] = useState("");
  const fn = useServerFn(askInsight);
  const execFn = useServerFn(executeAICommand);
  const m = useMutation({
    mutationFn: (q: string) => fn({ data: { persona, question: q } }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao consultar IA"),
  });
  const exec = useMutation({
    mutationFn: (a: AIAction) => execFn({ data: a as any }),
    onSuccess: (r: any) => toast.success(`Pronto — ${r.code ?? r.name ?? "ação"} criada`),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao executar"),
  });
  const active = PERSONAS.find((p) => p.id === persona)!;

  const parsed = useMemo(() => (m.data?.text ? parseAction(m.data.text) : { action: null, cleaned: "" }), [m.data?.text]);

  function ask(q: string) {
    if (!q.trim() || m.isPending) return;
    setQuestion(q);
    m.mutate(q);
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" />Pergunte ao especialista
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5 bg-muted/30">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={`text-xs px-2.5 py-1 rounded inline-flex items-center gap-1.5 transition-colors ${
                persona === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {active.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={m.isPending}
              className="text-[11px] px-2 py-1 rounded-full border border-border bg-muted/30 hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Pergunte ao ${active.label}…`}
            className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
          <button
            type="submit"
            disabled={m.isPending || !question.trim()}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Perguntar
          </button>
        </form>

        {m.isPending && (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Brain className="size-3.5" />Analisando dados em tempo real…
          </div>
        )}

        {m.data && !m.isPending && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.data.persona}</div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown content={parsed.action ? parsed.cleaned : m.data.text} />
            </div>

            {parsed.action && !exec.data && (
              <ActionEditor action={parsed.action} pending={exec.isPending} onConfirm={(a) => exec.mutate(a)} onDiscard={() => exec.reset()} />
            )}

            {exec.data && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Executado com sucesso.
                {(exec.data as any).link && (
                  <Link to={(exec.data as any).link} className="underline">Abrir tela</Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
