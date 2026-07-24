import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Plus, Package, Library, Sparkles, Scissors, FileText, Factory } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FabConfig = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * FAB "Nova ação" contextual — muda conforme a rota atual.
 * Ao clicar, dispara evento global `use-moda:new-action` que a página escuta
 * para abrir seu próprio Dialog de criação (sem depender de search params).
 */
const FAB_MAP: Record<string, FabConfig> = {
  "/produtos":      { to: "/produtos",      label: "Nova peça",      icon: Package },
  "/colecoes":      { to: "/colecoes",      label: "Nova coleção",   icon: Sparkles },
  "/prototipos":    { to: "/prototipos",    label: "Novo protótipo", icon: Scissors },
  "/ficha-tecnica": { to: "/ficha-tecnica", label: "Nova ficha",     icon: FileText },
  "/materiais":     { to: "/materiais",     label: "Novo material",  icon: Library },
};

export const FAB_EVENT = "use-moda:new-action";

export function useFabNewAction(handler: () => void) {
  useEffect(() => {
    const fn = () => handler();
    window.addEventListener(FAB_EVENT, fn);
    return () => window.removeEventListener(FAB_EVENT, fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function ContextualFab() {
  const { location } = useRouterState();
  const navigate = useNavigate();
  const cfg = FAB_MAP[location.pathname];
  if (!cfg) return null;
  const Icon = cfg.icon;

  const onClick = () => {
    // Página atual: apenas dispara evento.
    if (location.pathname === cfg.to) {
      window.dispatchEvent(new CustomEvent(FAB_EVENT));
      return;
    }
    // (fallback defensivo — hoje as chaves batem com o alvo)
    void navigate({ to: cfg.to as never });
    setTimeout(() => window.dispatchEvent(new CustomEvent(FAB_EVENT)), 250);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "fixed bottom-6 right-6 z-40 lg:bottom-8 lg:right-8",
              "size-14 rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground",
              "shadow-[var(--shadow-glow)] grid place-items-center relative",
              "hover:scale-105 active:scale-95 transition-transform",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={cfg.label}
          >
            <Plus className="size-6" strokeWidth={2.5} />
            <Icon className="size-3 absolute bottom-1.5 right-1.5 opacity-80" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {cfg.label} <span className="text-muted-foreground">· N</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
