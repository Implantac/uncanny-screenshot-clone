import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { normalizeRoles, type UserRole } from "@/lib/permissions";

/**
 * Hook que carrega as roles do usuário autenticado a partir de `user_roles`.
 * A RLS permite ao usuário ver apenas as suas próprias roles
 * (auth.uid() = user_id OR has_role(uid,'admin')).
 */
export function useUserRole() {
  const { user } = useAuth();

  const { data: roles = [], isLoading } = useQuery<UserRole[]>({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) {
        // Em caso de erro de RLS/permissão, falha silenciosa (sem role = leitura).
        return [];
      }
      return normalizeRoles((data ?? []).map((r) => (r as { role: unknown }).role));
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { roles, isLoading };
}
