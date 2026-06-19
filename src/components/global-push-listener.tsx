import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type PushRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  kind: string;
  sent_at: string;
};

const SEV_TOAST: Record<string, (m: string, o?: object) => unknown> = {
  critica: toast.error,
  alta: toast.warning,
  media: toast.info,
  baixa: toast.message,
};

/**
 * Cross-app realtime listener: assina inserts em push_notifications do usuário atual
 * e exibe toast clicável. Roda uma vez no AppShell (já está dentro do _authenticated).
 */
export function GlobalPushListener() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`push-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "push_notifications",
          filter: `owner_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as PushRow;
          // ignora entradas mais antigas que o mount (recuperação de cache realtime)
          if (new Date(row.sent_at).getTime() < mountedAt.current - 5000) return;

          const fn = SEV_TOAST[row.severity] ?? toast.message;
          fn(row.title, {
            description: row.body ?? undefined,
            duration: row.severity === "critica" ? 10_000 : 5000,
            action: row.link
              ? {
                  label: "Abrir",
                  onClick: () => navigate({ to: row.link as string }),
                }
              : undefined,
          });

          qc.invalidateQueries({ queryKey: ["push-notifications-recent"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc, navigate]);

  return null;
}
