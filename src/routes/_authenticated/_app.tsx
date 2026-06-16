import { createFileRoute, Outlet, useRouterState, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MODULES, moduleAllowed, moduleSector, SECTOR_LABEL } from "@/lib/modules";
import { useSectors } from "@/hooks/use-sectors";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <SectorGuard>
        <Outlet />
      </SectorGuard>
    </AppShell>
  );
}

function SectorGuard({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const { sectors, isAdmin, loading } = useSectors();
  if (loading) return <>{children}</>;

  const mod = MODULES.find((m) => m.path === location.pathname);
  if (!mod) return <>{children}</>;
  if (moduleAllowed(mod, sectors, isAdmin)) return <>{children}</>;

  const required = moduleSector(mod);
  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="glass rounded-2xl p-8 text-center">
        <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-lg font-semibold mb-1">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Esta tela pertence ao setor{" "}
          <strong>{required ? SECTOR_LABEL[required] : "—"}</strong> e não foi
          liberada para o seu usuário. Solicite acesso ao administrador.
        </p>
        <Link
          to="/"
          className="inline-block mt-4 text-xs text-primary hover:underline"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
