import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * TermTip — exibe um termo técnico acompanhado de uma explicação em português
 * simples, acessível por hover e foco (visível para usuários leigos).
 *
 * Exemplo:
 *   <TermTip term="BOM" tooltip="Lista de Materiais: a relação de tecidos,
 *   aviamentos e insumos usados para produzir a peça." />
 */
export function TermTip({
  term,
  tooltip,
  iconClassName,
}: {
  term: string;
  tooltip: string;
  iconClassName?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1 cursor-help text-inherit"
            tabIndex={0}
            aria-label={`${term}: ${tooltip}`}
          >
            {term}
            <HelpCircle
              className={cn("size-3 text-muted-foreground shrink-0", iconClassName)}
              aria-hidden
            />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-72 text-xs leading-relaxed font-normal"
          aria-live="polite"
        >
          <span className="font-semibold">{term}: </span>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
