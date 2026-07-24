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

  // Realtime: revalida contagem quando surge aprovação/comentário novo
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`my-products-unread-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "product_approvals" },
        () => qc.invalidateQueries({ queryKey: ["my-products-unread"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "product_timeline_comments" },
        () => qc.invalidateQueries({ queryKey: ["my-products-unread"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, qc]);


  const query = useQuery({
    enabled: !!uid,
    queryKey: ["my-products-unread", uid, lastSeen],
    refetchInterval: 60_000,
    queryFn: async () => {
      // Pending approvals created since last seen
      const { count: approvalsCount } = await supabase
        .from("product_approvals")
        .select("id", { count: "exact", head: true })
        .eq("decision", "pendente")
        .gt("created_at", lastSeen);

      // Real @mentions: comments where mentioned_user_ids contains me
      const { count: mCount } = await supabase
        .from("product_timeline_comments")
        .select("id", { count: "exact", head: true })
        .contains("mentioned_user_ids", [uid!])
        .neq("author_id", uid!)
        .gt("created_at", lastSeen);

      const approvals = approvalsCount ?? 0;
      const mentions = mCount ?? 0;
      return {
        approvals,
        mentions,
        total: approvals + mentions,
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
