import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { askInsight } from "@/lib/ai-insights.functions";
import { Markdown } from "@/components/markdown";
import { InlineChart } from "@/components/inline-chart";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";

type Persona = "development" | "pcp" | "marketing";

const LABEL: Record<Persona, string> = {
  development: "Coordenador de Desenvolvimento",
  pcp: "Coordenador de PCP",
  marketing: "Marketing Intelligence",
};

const DEFAULT_QUESTION: Record<Persona, string> = {
  development: "Quais os 3 pontos mais críticos do desenvolvimento agora e o que fazer?",
  pcp: "Quais são os 3 gargalos do dia e qual a prioridade de ação?",
  marketing: "Onde devo investir hoje e por quê? Cite 3 ações concretas.",
};

/** Painel proativo de IA reutilizável (Dev / PCP / Marketing). */
export function AICoordinatorPanel({
  persona,
  question,
  title,
  autoLoad = true,
}: {
  persona: Persona;
  question?: string;
  title?: string;
  autoLoad?: boolean;
}) {
  const { user, loading: authLoading } = useAuth();
  const ask = useServerFn(askInsight);
  const mutation = useMutation({
    mutationFn: () => ask({ data: { persona, question: question ?? DEFAULT_QUESTION[persona] } }),
  });

  useEffect(() => {
    if (autoLoad && user) mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, persona, question, user?.id]);

  return (
    <div className="glass rounded-xl p-5 flex flex-col min-h-[260px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold leading-tight">{title ?? LABEL[persona]}</div>
            <div className="text-[11px] text-muted-foreground">
              IA explica o motivo, não só o número
            </div>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || authLoading || !user}
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label={mutation.isPending ? "Atualizando insights" : "Atualizar insights"}
          title="Atualizar"
        >
          {mutation.isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="flex-1 text-sm">
        {authLoading ? (
          <div className="h-5 w-40 animate-pulse rounded bg-muted/40" />
        ) : !user ? (
          <div className="text-xs text-muted-foreground">
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Entre na sua conta
            </Link>{" "}
            para consultar o Agente USE com os dados da empresa.
          </div>
        ) : mutation.isPending && !mutation.data ? (
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
