import { Link, useRouterState } from "@tanstack/react-router";
import { Plus, Package, Library, Sparkles, Scissors, FileText, Factory } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FabConfig = {
  to: string;
  search?: Record<string, unknown>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * FAB "Nova ação" contextual — muda conforme a rota atual.
 * Menos cliques para as ações mais criadas em cada área do PLM.
 */
const FAB_MAP: Record<string, FabConfig> = {
  "/produtos":    { to: "/produtos",   search: { new: 1 }, label: "Nova peça",       icon: Package },
  "/materiais":   { to: "/materiais",  search: { new: 1 }, label: "Novo material",   icon: Library },
  "/colecoes":    { to: "/colecoes",   search: { new: 1 }, label: "Nova coleção",    icon: Sparkles },
  "/prototipos":  { to: "/prototipos", search: { new: 1 }, label: "Novo protótipo",  icon: Scissors },
  "/ficha-tecnica": { to: "/ficha-tecnica", search: { new: 1 }, label: "Nova ficha", icon: FileText },
  "/pcp-kanban":  { to: "/pcp-kanban", search: { new: 1 }, label: "Nova OP",         icon: Factory },
};

export function ContextualFab() {
  const { location } = useRouterState();
  const cfg = FAB_MAP[location.pathname];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={cfg.to as never}
            search={cfg.search as never}
            className={cn(
              "fixed bottom-6 right-6 z-40 lg:bottom-8 lg:right-8",
              "size-14 rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground",
              "shadow-[var(--shadow-glow)] grid place-items-center",
              "hover:scale-105 active:scale-95 transition-transform",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={cfg.label}
          >
            <Plus className="size-6" strokeWidth={2.5} />
            <Icon className="size-3 absolute bottom-1.5 right-1.5 opacity-80" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {cfg.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
