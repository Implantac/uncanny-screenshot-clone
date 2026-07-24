import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { Bell, AtSign, ClipboardCheck, Sparkles, Factory, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/preferencias-notificacoes")({
  head: () => ({
    meta: [
      { title: "Preferências de notificação · USE MODA PLM" },
      { name: "description", content: "Configure quais notificações você deseja receber por push, e-mail ou silenciar." },
    ],
  }),
  component: NotificationPreferencesPage,
});

type Category = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const CATEGORIES: Category[] = [
  { key: "mention", label: "Menções (@)", description: "Quando alguém marca você em um comentário do produto.", icon: AtSign },
  { key: "approval", label: "Aprovações pendentes", description: "Quando um gate ou ficha aguarda sua decisão.", icon: ClipboardCheck },
  { key: "digest", label: "Resumo diário", description: "Consolidação diária de aprovações e menções não vistas.", icon: Sparkles },
  { key: "production", label: "Produção e PCP", description: "Alertas de atraso, passagem de setor e ocorrências.", icon: Factory },
  { key: "quality", label: "Qualidade e CAPA", description: "Reprovações, não-conformidades e ações corretivas.", icon: ShieldCheck },
];

type PrefRow = { category: string; muted: boolean; push_enabled: boolean; email_enabled: boolean };

function NotificationPreferencesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs = [] } = useQuery({
    enabled: !!user,
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("category, muted, push_enabled, email_enabled")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as PrefRow[];
    },
  });

  const [local, setLocal] = useState<Record<string, PrefRow>>({});

  useEffect(() => {
    const next: Record<string, PrefRow> = {};
    for (const c of CATEGORIES) {
      const existing = prefs.find((p) => p.category === c.key);
      next[c.key] = existing ?? { category: c.key, muted: false, push_enabled: true, email_enabled: false };
    }
    setLocal(next);
  }, [prefs]);

  const save = useMutation({
    mutationFn: async (row: PrefRow) => {
      if (!user) throw new Error("no user");
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          { user_id: user.id, category: row.category, muted: row.muted, push_enabled: row.push_enabled, email_enabled: row.email_enabled },
          { onConflict: "user_id,category" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
      toast.success("Preferência atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (key: string, patch: Partial<PrefRow>) => {
    const merged = { ...local[key], ...patch };
    setLocal((s) => ({ ...s, [key]: merged }));
    save.mutate(merged);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Preferências de notificação"
        description="Escolha, por categoria, se deseja receber push, e-mail ou silenciar completamente."
        icon={Bell}
      />

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {CATEGORIES.map((c) => {
          const row = local[c.key];
          if (!row) return null;
          const Icon = c.icon;
          return (
            <div key={c.key} className="p-4 flex items-start gap-3">
              <div className="size-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
                    <span>Silenciar</span>
                    <Switch
                      checked={row.muted}
                      onCheckedChange={(v) => update(c.key, { muted: v })}
                      aria-label={`Silenciar ${c.label}`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
                    <span>Push no app</span>
                    <Switch
                      checked={row.push_enabled && !row.muted}
                      disabled={row.muted}
                      onCheckedChange={(v) => update(c.key, { push_enabled: v })}
                      aria-label={`Push ${c.label}`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
                    <span>E-mail</span>
                    <Switch
                      checked={row.email_enabled && !row.muted}
                      disabled={row.muted}
                      onCheckedChange={(v) => update(c.key, { email_enabled: v })}
                      aria-label={`E-mail ${c.label}`}
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        As preferências são aplicadas em tempo real ao gatilho de menções e ao resumo diário. O envio por e-mail depende da integração de e-mail configurada.
      </p>
    </div>
  );
}
