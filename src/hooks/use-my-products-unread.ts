import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const LS_KEY = "usemoda:meus-produtos:last-seen";

function readLastSeen(): string {
  try {
    return localStorage.getItem(LS_KEY) || new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

export function useMyProductsUnread() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [lastSeen, setLastSeen] = useState<string>(() => readLastSeen());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setLastSeen(readLastSeen());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const query = useQuery({
    enabled: !!uid,
    queryKey: ["my-products-unread", uid, lastSeen],
    refetchInterval: 60_000,
    queryFn: async () => {
      // Watched product IDs for mentions/comments
      const { data: watched } = await supabase
        .from("product_watchers")
        .select("product_id")
        .eq("user_id", uid!);
      const watchedIds = (watched ?? []).map((w) => w.product_id);

      // Pending approvals created since last seen
      const { count: approvalsCount } = await supabase
        .from("product_approvals")
        .select("id", { count: "exact", head: true })
        .eq("decision", "pendente")
        .gt("created_at", lastSeen);

      let mentionsCount = 0;
      if (watchedIds.length > 0) {
        const { count } = await supabase
          .from("product_timeline_comments")
          .select("id", { count: "exact", head: true })
          .in("product_id", watchedIds)
          .neq("author_id", uid!)
          .gt("created_at", lastSeen);
        mentionsCount = count ?? 0;
      }

      const approvals = approvalsCount ?? 0;
      return {
        approvals,
        mentions: mentionsCount,
        total: approvals + mentionsCount,
      };
    },
  });

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(LS_KEY, now);
    } catch {
      /* ignore */
    }
    setLastSeen(now);
    qc.invalidateQueries({ queryKey: ["my-products-unread"] });
  }, [qc]);

  return {
    approvals: query.data?.approvals ?? 0,
    mentions: query.data?.mentions ?? 0,
    total: query.data?.total ?? 0,
    lastSeen,
    markAllRead,
    isLoading: query.isLoading,
  };
}
