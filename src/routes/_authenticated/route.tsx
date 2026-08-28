import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Acesso liberado: usuários podem navegar sem login.
  // A sessão continua sendo lida quando existir (para personalização),
  // mas a ausência dela não bloqueia mais a navegação.
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getUser();
      return { user: data?.user ?? null };
    } catch {
      return { user: null };
    }
  },
  component: () => <Outlet />,
});

