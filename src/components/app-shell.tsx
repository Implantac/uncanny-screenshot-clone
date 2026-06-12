import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut, Menu, Sun, Moon } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { NotificationsBell } from "./notifications-bell";
import { MODULES, MODULE_GROUPS } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect, type ReactNode } from "react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", gerente: "Gerente", designer: "Designer", comprador: "Comprador", vendedor: "Vendedor",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const active = location.pathname;
  const { user } = useAuth();
  const { primary } = useRoles();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [active]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const initials = (user?.user_metadata?.full_name || user?.email || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
        <div className="size-8 rounded-lg bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">USE MODA</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fashion OS</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 text-sm">
        {MODULE_GROUPS.map((group) => (
          <div key={group}>
            <div className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {group}
            </div>
            <ul className="space-y-0.5">
              {MODULES.filter((m) => m.group === group).map((m) => {
                const isActive = active === m.path;
                const Icon = m.icon;
                return (
                  <li key={m.slug}>
                    <Link
                      to={m.path}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className={cn("size-4", isActive && "text-primary")} />
                      <span className="truncate">{m.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 p-3 rounded-lg glass">
        <div className="flex items-center gap-2 text-xs font-medium">
          <div className="size-2 rounded-full bg-success animate-pulse" />
          Sistema operacional
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          18 módulos · 99.98% uptime
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center gap-2 sm:gap-3 px-3 sm:px-5 sticky top-0 z-10 bg-background/80 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border flex flex-col">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {sidebarContent}
            </SheetContent>
          </Sheet>

          <CommandPalette />
          <NotificationsBell />
          <div className="flex items-center gap-2 pl-2 sm:pl-3 sm:ml-1 sm:border-l border-border">
            <div className="size-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center text-xs font-semibold text-primary-foreground">{initials || "U"}</div>
            <div className="text-xs leading-tight hidden md:block">
              <div className="font-medium truncate max-w-[120px]">{user?.user_metadata?.full_name || user?.email}</div>
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

