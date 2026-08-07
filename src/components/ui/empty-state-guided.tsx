import * as React from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export type GuidedStep = {
  label: string;
  description?: string;
  action?: React.ReactNode;
};

/**
 * EmptyStateGuided — estado vazio instrutivo para usuários leigos.
 * Mostra um ícone, um título, uma descrição encorajadora e uma lista
 * numerada de próximos passos (cada um podendo conter uma ação).
 *
 * Exemplo:
 *   <EmptyStateGuided
 *     icon={Package}
 *     title="Nenhum produto cadastrado"
 *     description="Comece criando seu primeiro produto em poucos passos."
 *     steps={[
 *       { label: "Preencha nome e coleção", description: "…" },
 *       { label: "Cadastre a ficha técnica", description: "…", action: <Link …/> },
 *     ]}
 *   />
 */
export function EmptyStateGuided({
  icon,
  title = "Nada por aqui ainda",
  description,
  steps = [],
  className,
}: {
  icon: LucideIcon;
  title?: string;
  description?: string;
  steps?: GuidedStep[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-card/30 p-6", className)}>
      <EmptyState icon={icon} title={title} description={description} compact className="pb-2" />
      {steps.length > 0 && (
        <ol className="mx-auto mt-4 max-w-md space-y-2">
          {steps.map((step, index) => (
            <li
              key={index}
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-3"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{step.label}</div>
                {step.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </div>
                )}
              </div>
              {step.action && (
                <div className="shrink-0">
                  <span className="inline-flex items-center text-primary">
                    {step.action} <ArrowRight className="size-3.5 ml-1" />
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
