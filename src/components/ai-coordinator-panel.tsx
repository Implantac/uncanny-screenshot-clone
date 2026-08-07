import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { askInsight } from "@/lib/ai-insights.functions";
import { Markdown } from "@/components/markdown";
import { InlineChart } from "@/components/inline-chart";
import { cn } from "@/lib/utils";

export type AIPersona = "development" | "pcp" | "marketing";

const LABEL: Record<AIPersona, string> = {
  development: "Desenvolvimento",
  pcp: "Produção (PCP)",
  marketing: "Marketing",
};

const FULL_LABEL: Record<AIPersona, string> = {
  development: "Coordenador de Desenvolvimento",
  pcp: "Coordenador de PCP",
  marketing: "Marketing Intelligence",
};

const DEFAULT_QUESTION: Record<AIPersona, string> = {
  development: "Quais os 3 pontos mais críticos do desenvolvimento agora e o que fazer?",
  pcp: "Quais são os 3 gargalos do dia e qual a prioridade de ação?",
  marketing: "Onde devo investir hoje e por quê? Cite 3 ações concretas.",
};

type Props =
  | {
      persona: AIPersona;
      question?: string;
      title?: string;
      autoLoad?: boolean;
      /** Se `true`, renderiza abas para alternar entre personas (1 chamada por vez). */
      personaSelector?: false;
    }
  | {
      persona?: AIPersona;
      question?: string;
      title?: string;
      autoLoad?: boolean;
      personaSelector: true;
    };

/**
 * Painel proativo de IA reutilizável (Dev / PCP / Marketing).
 * Com `personaSelector`, monta um único painel com abas — reduzindo chamadas
 * concorrentes ao modelo (antes: 1 painel por persona carregava N vezes).
 */
export function AICoordinatorPanel({
  persona: initialPersona = "development",
  question,
  title,
  autoLoad = true,
  personaSelector = false,
}: Props) {
  const [active, setActive] = useState<AIPersona>(initialPersona);
  const persona = personaSelector ? active : initialPersona;

  const ask = useServerFn(askInsight);
  const mutation = useMutation({
    mutationFn: () => ask({ data: { persona, question: question ?? DEFAULT_QUESTION[persona] } }),
  });

  useEffect(() => {
    if (autoLoad) mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, question]);

  return (
    <div className="glass rounded-xl p-5 flex flex-col min-h-[260px]">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold leading-tight">
              {title ?? FULL_LABEL[persona]}
            </div>
            <div className="text-[11px] text-muted-foreground">
              IA explica o motivo, não só o número
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 min-h-8 min-w-8 justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={mutation.isPending ? "Atualizando insights" : "Atualizar insights"}
          title="Atualizar"
        >
          {mutation.isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3" aria-hidden="true" />
          )}
        </button>
      </div>

      {personaSelector && (
        <div
          role="tablist"
          aria-label="Selecionar análise de IA"
          className="flex flex-wrap gap-1 mb-3"
        >
          {(Object.keys(LABEL) as AIPersona[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={persona === p}
              onClick={() => setActive(p)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                persona === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {LABEL[p]}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 text-sm">
        {mutation.isPending && !mutation.data ? (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" /> Analisando dados…
          </div>
        ) : mutation.error ? (
          <div className="text-xs text-destructive">
            Falha ao consultar IA: {(mutation.error as Error).message}
          </div>
        ) : mutation.data ? (
          <>
            <Markdown content={mutation.data.text} />
            <InlineChart text={mutation.data.text} />
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Clique em atualizar para gerar insights.
          </div>
        )}
      </div>
    </div>
  );
}
