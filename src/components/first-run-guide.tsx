import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Package, FileText, Scissors, Factory, X, ChevronRight } from "lucide-react";

/**
 * FirstRunGuide — onboarding de primeiros passos para usuários leigos.
 *
 * Exibe uma introdução simples (bem-vindo + passo a passo do fluxo PLM) na
 * primeira visita, evitando o choque de uma tela cheia de módulos. O usuário
 * pode dispensar permanentemente (guardado em localStorage) ou pular.
 */
const GUIDE_KEY = "usemoda:first-run-guide.v1";

type Step = {
  icon: typeof Package;
  title: string;
  description: string;
  to?: string;
  hint?: string;
};

const STEPS: Step[] = [
  {
    icon: Package,
    title: "Cadastre um produto",
    description: "Cada peça começa como um produto (SKU) com coleção, grade de tamanhos e cores.",
    to: "/produtos",
    hint: "Produtos",
  },
  {
    icon: FileText,
    title: "Monte a ficha técnica",
    description:
      "Adicione materiais (BOM), operações, medidas e custos. O sistema calcula tudo sozinho.",
    to: "/ficha-tecnica",
    hint: "Ficha técnica",
  },
  {
    icon: Scissors,
    title: "Aprove piloto e protótipo",
    description:
      "Com o croqui aprovado, solicite o piloto e acompanhe o protótipo até a aprovação final.",
    to: "/prototipos",
    hint: "Protótipos",
  },
  {
    icon: Factory,
    title: "Libere a produção",
    description:
      "Ficha aprovada + piloto aprovado destravam a ordem de produção no PCP. Acompanhe em tempo real.",
    to: "/pcp",
    hint: "PCP",
  },
];

function getDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return true;
  }
}

export function FirstRunGuide() {
  const [dismissed, setDismissed] = useState(getDismissed);

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Bem-vindo ao USE MODA OS</div>
            <div className="text-xs text-muted-foreground">
              Guia rápido — siga estes passos para operar o ciclo do produto.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar guia de primeiros passos"
          className="size-7 grid place-items-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const body = (
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-3 h-full hover:border-primary/40 hover:bg-background/60 transition-colors">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="size-7 rounded-full bg-primary/15 text-primary text-xs font-semibold grid place-items-center">
                  {index + 1}
                </div>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">{step.title}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {step.description}
                </div>
                {step.to && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-primary mt-2">
                    {step.hint ?? "Abrir"} <ChevronRight className="size-3" />
                  </span>
                )}
              </div>
            </div>
          );
          return step.to ? (
            <Link key={step.title} to={step.to as string} onClick={() => dismiss()}>
              {body}
            </Link>
          ) : (
            <div key={step.title}>{body}</div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3">
        <p className="text-[11px] text-muted-foreground">
          💡 Você pode reabrir este guia a partir do menu de atalhos.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Entendi, dispensar
        </button>
      </div>
    </div>
  );
}
