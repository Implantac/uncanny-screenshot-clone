import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useRoles } from "./use-role";
import type { AppSector } from "@/lib/modules";
import { APP_SECTORS } from "@/lib/modules";

export function useSectors() {
  const { user } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();

  const q = useQuery({
    queryKey: ["user-sectors", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppSector[]> => {
      const { data, error } = await supabase
        .from("user_sectors")
        .select("sector")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.sector as AppSector);
    },
  });

  const sectors: AppSector[] = isAdmin ? APP_SECTORS : (q.data ?? []);
  return {
    sectors,
    isAdmin,
    loading: rolesLoading || q.isLoading,
    has: (s: AppSector) => isAdmin || sectors.includes(s),
  };
}
