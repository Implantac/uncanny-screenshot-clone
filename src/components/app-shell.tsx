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
} from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { CommandPalette } from "./command-palette";
import { NotificationsBell } from "./notifications-bell";
import { MyProductsInboxButton } from "./my-products-inbox-button";
import { SectorChatButton } from "./sector-chat";
import {
  MODULES,
  MODULE_GROUPS,
  moduleAllowed,
  type ModuleDef,
  type ModuleGroup,
} from "@/lib/modules";
import { useSectors } from "@/hooks/use-sectors";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useEffect, useMemo, type ReactNode } from "react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  designer: "Designer",
  comprador: "Comprador",
  vendedor: "Vendedor",
};

const SIDEBAR_COLLAPSED_KEY = "usemoda:sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const active = location.pathname;
  const { user } = useAuth();
  const { primary } = useRoles();
  const { sectors, isAdmin } = useSectors();
  const visibleModules = MODULES.filter((m) => !m.hidden && moduleAllowed(m, sectors, isAdmin));
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") setCollapsed(true);
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

  // Group → modules e qual grupo contém a rota ativa
  const grouped = useMemo(() => {
    const map = new Map<ModuleGroup, { items: ModuleDef[]; activeIn: boolean }>();
    for (const g of MODULE_GROUPS) map.set(g, { items: [], activeIn: false });
    for (const m of visibleModules) {
      const bucket = map.get(m.group);
      if (!bucket) continue;
      bucket.items.push(m);
      if (active === m.path) bucket.activeIn = true;
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
        {MODULE_GROUPS.map((group) => {
          const bucket = grouped.get(group);
          if (!bucket || bucket.items.length === 0) return null;
          const isOpen = openGroups[group] ?? bucket.activeIn ?? false;
          const totalCount = bucket.items.length;

          const renderItem = (m: ModuleDef) => {
            const isActive = active === m.path;
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
                      isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover/nav:text-sidebar-foreground",
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
        <div className="m-3 p-3 rounded-lg glass">
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="size-2 rounded-full bg-success animate-pulse" />
            Sistema operacional
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">18 módulos · 99.98% uptime</div>
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
          <NotificationsBell />
          <div className="flex items-center gap-2 pl-2 sm:pl-3 sm:ml-1 sm:border-l border-border">
            <div className="size-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center text-xs font-semibold text-primary-foreground">
              {initials || "U"}
            </div>
            <div className="text-xs leading-tight hidden md:block">
              <div className="font-medium truncate max-w-[120px]">
                {user?.user_metadata?.full_name || user?.email}
              </div>
              <div className="text-muted-foreground">{ROLE_LABEL[primary] ?? "Designer"}</div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sair"
              className="size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
