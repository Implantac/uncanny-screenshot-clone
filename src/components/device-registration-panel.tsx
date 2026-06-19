import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Bell, BellOff, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  registerCurrentBrowserAsDevice,
  toggleDevicePush,
} from "@/lib/device-registration.functions";
import { enqueuePushForCurrentUser } from "@/lib/push-notifications.functions";

const DEVICE_KEY = "use-moda:push-token";

function getOrCreateToken(): string {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem(DEVICE_KEY);
  if (!t) {
    t =
      "web_" +
      (crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(DEVICE_KEY, t);
  }
  return t;
}

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios-web";
  if (/Android/i.test(ua)) return "android-web";
  if (/Mac/i.test(ua)) return "macos-web";
  if (/Windows/i.test(ua)) return "windows-web";
  return "web";
}

type DeviceRow = {
  id: string;
  user_name: string;
  platform: string;
  app_version: string;
  active: boolean;
  push_token: string | null;
  push_enabled: boolean;
  last_seen_at: string;
};

export function DeviceRegistrationPanel() {
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  useEffect(() => setToken(getOrCreateToken()), []);

  const registerFn = useServerFn(registerCurrentBrowserAsDevice);
  const toggleFn = useServerFn(toggleDevicePush);
  const pushFn = useServerFn(enqueuePushForCurrentUser);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["my-mobile-devices"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("mobile_devices")
        .select("id, user_name, platform, app_version, active, push_token, push_enabled, last_seen_at")
        .eq("owner_id", u.user.id)
        .order("last_seen_at", { ascending: false });
      return (data ?? []) as DeviceRow[];
    },
  });

  const isRegistered = devices.some((d) => d.push_token === token);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userName =
        (u.user?.user_metadata?.full_name as string | undefined) ??
        u.user?.email?.split("@")[0] ??
        "Usuário";
      return registerFn({
        data: {
          user_name: userName,
          platform: detectPlatform(),
          app_version: "web-1.0.0",
          push_token: token,
          push_provider: "web",
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.created ? "Navegador registrado para receber push" : "Dispositivo atualizado");
      qc.invalidateQueries({ queryKey: ["my-mobile-devices"] });
      qc.invalidateQueries({ queryKey: ["mobile-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) =>
      toggleFn({ data: { device_id: v.id, enabled: v.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-mobile-devices"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      pushFn({
        data: {
          title: "🔔 Push de teste",
          body: "Sua fila de notificações está funcionando.",
          link: "/mobile",
          kind: "test",
          severity: "media",
        },
      }),
    onSuccess: (res) => {
      if (res.enqueued > 0) {
        toast.success(`Enviado para ${res.enqueued} dispositivo(s)`);
        qc.invalidateQueries({ queryKey: ["push-notifications-recent"] });
      } else {
        toast.warning("Registre este navegador primeiro");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-widest">
            Meus dispositivos
          </h3>
          <Badge variant="outline" className="text-[10px]">
            {devices.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isRegistered && (
            <Button
              size="sm"
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending || !token}
            >
              <Plus className="size-3.5 mr-1" />
              Registrar este navegador
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || devices.length === 0}
          >
            <Bell className="size-3.5 mr-1" />
            Push de teste
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-16 bg-muted/30 rounded animate-pulse" />
      ) : devices.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Nenhum dispositivo registrado. Clique em "Registrar este navegador".
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {devices.map((d) => {
            const isThis = d.push_token === token;
            return (
              <li key={d.id} className="py-2 flex items-center gap-3">
                <Smartphone className="size-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{d.user_name}</span>
                    {isThis && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        este
                      </Badge>
                    )}
                    {!d.push_token && (
                      <Badge variant="outline" className="text-[10px]">
                        sem token
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.platform} · {d.app_version} ·{" "}
                    {new Date(d.last_seen_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                {d.push_token && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title={d.push_enabled ? "Desativar push" : "Ativar push"}
                    onClick={() =>
                      toggleMutation.mutate({ id: d.id, enabled: !d.push_enabled })
                    }
                  >
                    {d.push_enabled ? (
                      <Bell className="size-3.5 text-emerald-400" />
                    ) : (
                      <BellOff className="size-3.5 text-muted-foreground" />
                    )}
                  </Button>
                )}
                {d.active && <CheckCircle2 className="size-3.5 text-emerald-400" />}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
