import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
} from "lucide-react";

import logoAsset from "@/assets/logo.png.asset.json";
import { CommandPaletteLazy as CommandPalette } from "./command-palette-lazy";
import { NotificationsBell } from "./notifications-bell";
import { MyProductsInboxButton } from "./my-products-inbox-button";
import { SectorChatButton } from "./sector-chat";
import {
  MODULES,
  LIFECYCLE_PHASES,
  modulePhase,
  moduleAllowed,
  moduleAllowedForRole,
  type ModuleDef,
  type LifecyclePhase,
} from "@/lib/modules";

import { useSectors } from "@/hooks/use-sectors";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextualFab } from "@/components/contextual-fab";
import { useState, useEffect, useMemo, type ReactNode } from "react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  designer: "Designer",
  comprador: "Comprador",
  vendedor: "Vendedor",
};

const SIDEBAR_COLLAPSED_KEY = "usemoda:sidebar-collapsed";
const SIDEBAR_SHOW_ALL_KEY = "usemoda:sidebar-show-all";

/**
 * "Começar por aqui" — módulos essenciais do fluxo PLM básico.
 * Apresentados no topo da sidebar para orientar usuários leigos pelo
 * caminho principal sem precisar entender as fases do ciclo de vida.
 */
const ESSENTIAL_SLUGS = ["produtos", "ficha-tecnica", "prototipos", "pcp"];
const ESSENTIAL_MODULES = MODULES.filter((m) => ESSENTIAL_SLUGS.includes(m.slug));

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const active = location.pathname;
  const { user } = useAuth();
  const { primary, isAdmin: isAdminRole } = useRoles();
  const { sectors, isAdmin } = useSectors();
  // Visitante sem login enxerga o menu completo (leitura); RLS limita os dados.
  const canSeeAll = isAdmin || isAdminRole || primary === "gerente" || !user;
  const [showAll, setShowAll] = useState(false);
  const visibleModules = MODULES.filter(
    (m) =>
      !m.hidden &&
      moduleAllowed(m, sectors, isAdmin) &&
      (canSeeAll || showAll || moduleAllowedForRole(m, primary)),
  );
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") setCollapsed(true);
      const s = localStorage.getItem(SIDEBAR_SHOW_ALL_KEY);
      if (s === "1") setShowAll(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [active]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Fase (ciclo de vida) → módulos, marcando a fase que contém a rota ativa
  const grouped = useMemo(() => {
    const map = new Map<LifecyclePhase, { items: ModuleDef[]; activeIn: boolean }>();
    for (const p of LIFECYCLE_PHASES) map.set(p, { items: [], activeIn: false });
    for (const m of visibleModules) {
      const bucket = map.get(modulePhase(m));
      if (!bucket) continue;
      bucket.items.push(m);
      // Child route match: exact, startsWith(path + "/"), or singular/plural fallback
      const isActive =
        active === m.path ||
        (active.startsWith(m.path + "/") && m.path !== "/") ||
        (m.path.endsWith("s") && active.startsWith(m.path.slice(0, -1) + "/"));
      if (isActive) bucket.activeIn = true;
    }
    return map;
  }, [visibleModules, active]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !(s[g] ?? false) }));

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const initials = (user?.user_metadata?.full_name || user?.email || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  const renderSidebar = (isCollapsed: boolean) => (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "flex items-center gap-2 h-16 border-b border-sidebar-border",
          isCollapsed ? "px-2 justify-center" : "px-5",
        )}
      >
        <div className="size-9 rounded-lg grid place-items-center shadow-[var(--shadow-glow)] overflow-hidden shrink-0">
          <img src={logoAsset.url} alt="USE MODA" className="size-9 object-contain" />
        </div>
        {!isCollapsed && (
          <div className="leading-tight flex-1 min-w-0">
            <div className="text-sm font-semibold tracking-tight">USE MODA</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Fashion OS
            </div>
          </div>
        )}
        {!isCollapsed && (
          <button
            onClick={toggleCollapsed}
            title="Retrair menu"
            className="hidden lg:grid size-8 place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-3 space-y-1 text-sm",
          isCollapsed ? "px-2" : "px-3",
        )}
      >
        {/* "Começar por aqui" — atalhos essenciais para usuários leigos */}
        {!isCollapsed && (
          <div className="mb-2">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/70">
              Começar por aqui
            </div>
            <ul className="space-y-0.5">
              {ESSENTIAL_MODULES.filter((m) => moduleAllowed(m, sectors, isAdmin)).map((m) => {
                const Icon = m.icon;
                const isActive =
                  active === m.path || (active.startsWith(m.path + "/") && m.path !== "/");
                return (
                  <li key={m.slug}>
                    <Link
                      to={m.path}
                      className={cn(
                        "group/nav relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors duration-150",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-emerald-500 transition-opacity",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <Icon
                        className={cn(
                          "size-4 transition-colors",
                          isActive
                            ? "text-emerald-500"
                            : "text-sidebar-foreground/60 group-hover/nav:text-sidebar-foreground",
                        )}
                      />
                      <span className="truncate flex-1">{m.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mx-2 my-2 border-t border-sidebar-border/60" />
          </div>
        )}

        {LIFECYCLE_PHASES.map((group) => {
          const bucket = grouped.get(group);
          if (!bucket || bucket.items.length === 0) return null;
          const isOpen = openGroups[group] ?? bucket.activeIn ?? false;
          const totalCount = bucket.items.length;

          const renderItem = (m: ModuleDef) => {
            const isActive =
              active === m.path ||
              (active.startsWith(m.path + "/") && m.path !== "/") ||
              (m.path.endsWith("s") && active.startsWith(m.path.slice(0, -1) + "/"));
            const Icon = m.icon;
            const isErp = m.source === "erp-mirror";

            if (isCollapsed) {
              return (
                <li key={m.slug}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={m.path}
                        className={cn(
                          "flex items-center justify-center size-10 rounded-md transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className={cn("size-4", isActive && "text-primary")} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-2">
                      <span>{m.title}</span>
                      {isErp && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          ERP
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return (
              <li key={m.slug}>
                <Link
                  to={m.path}
                  className={cn(
                    "group/nav relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <Icon
                    className={cn(
                      "size-4 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground/60 group-hover/nav:text-sidebar-foreground",
                    )}
                  />
                  <span className="truncate flex-1">{m.title}</span>
                  {isErp && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      ERP
                    </span>
                  )}
                </Link>
              </li>
            );
          };

          if (isCollapsed) {
            return (
              <ul key={group} className="space-y-0.5 mb-2">
                {bucket.items.map(renderItem)}
                <li className="mx-2 my-2 border-t border-sidebar-border/60" />
              </ul>
            );
          }

          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40 transition-colors"
              >
                {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                <span className="flex-1 text-left">{group}</span>
                <span className="text-[10px] font-normal text-muted-foreground/70">
                  {totalCount}
                </span>
              </button>
              {isOpen && <ul className="space-y-0.5 mt-1 mb-2">{bucket.items.map(renderItem)}</ul>}
            </div>
          );
        })}
      </nav>
      {!isCollapsed && (
        <div className="m-3 p-3 rounded-lg glass space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="size-2 rounded-full bg-success animate-pulse" />
            Sistema operacional
          </div>
          <div className="text-[11px] text-muted-foreground">
            {visibleModules.length} módulos visíveis
          </div>
          {!canSeeAll && (
            <button
              type="button"
              onClick={() => {
                setShowAll((s) => {
                  const next = !s;
                  try {
                    localStorage.setItem(SIDEBAR_SHOW_ALL_KEY, next ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                  return next;
                });
              }}
              className="w-full text-[11px] px-2 py-1 rounded-md border border-sidebar-border hover:bg-sidebar-accent/40 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAll ? "Mostrar só meu perfil" : "Mostrar todos os módulos"}
            </button>
          )}
        </div>
      )}
    </TooltipProvider>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          "hidden lg:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar h-screen sticky top-0 transition-[width] duration-200",
          collapsed ? "w-14" : "w-64",
        )}
      >
        {renderSidebar(collapsed)}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-16 shrink-0 border-b border-border flex items-center gap-2 sm:gap-3 px-3 sm:px-5 bg-background/80 backdrop-blur z-10">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-72 bg-sidebar border-sidebar-border flex flex-col"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {renderSidebar(false)}
            </SheetContent>
          </Sheet>

          {collapsed && (
            <button
              onClick={toggleCollapsed}
              title="Expandir menu"
              className="hidden lg:grid size-9 place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          )}

          <CommandPalette />
          <button
            onClick={toggle}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <SectorChatButton />
          <MyProductsInboxButton />
          <button
            type="button"
            title="Atalhos de teclado (?)"
            aria-label="Abrir atalhos de teclado"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
            }}
            className="size-9 hidden sm:grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Keyboard className="size-4" />
          </button>
          <NotificationsBell />

          <div className="flex items-center gap-2 pl-2 sm:pl-3 sm:ml-1 sm:border-l border-border">
            <div className="size-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center text-xs font-semibold text-primary-foreground">
              {user ? initials || "U" : "?"}
            </div>
            <div className="text-xs leading-tight hidden md:block">
              <div className="font-medium truncate max-w-[120px]">
                {user?.user_metadata?.full_name || user?.email || "Visitante"}
              </div>
              <div className="text-muted-foreground">
                {user ? (ROLE_LABEL[primary] ?? "Designer") : "Sem login"}
              </div>
            </div>
            {user ? (
              <button
                onClick={handleSignOut}
                title="Sair"
                className="size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="size-4" />
              </button>
            ) : (
              <Link
                to="/auth"
                title="Entrar"
                className="h-9 px-3 grid place-items-center rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
              >
                Entrar
              </Link>
            )}
          </div>

        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <ContextualFab />
    </div>
  );
}
