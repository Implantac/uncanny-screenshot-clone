import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole = "admin" | "gerente" | "designer" | "comprador" | "vendedor";

export function useRoles() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  const primary: AppRole = roles.includes("admin")
    ? "admin"
    : roles.includes("gerente")
      ? "gerente"
      : (roles[0] ?? "designer");
  return {
    roles,
    primary,
    isAdmin: roles.includes("admin"),
    isGerente: roles.includes("gerente"),
    loading: q.isLoading,
  };
}
