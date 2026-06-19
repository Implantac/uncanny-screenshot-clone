import { createFileRoute } from "@tanstack/react-router";
import { Smartphone, Apple, Download, Star, Bell, ScanLine, MapPin, Wifi } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { PushHistoryPanel } from "@/components/push-history-panel";
import { DeviceRegistrationPanel } from "@/components/device-registration-panel";

export const Route = createFileRoute("/_authenticated/_app/mobile")({
  head: () => ({
    meta: [
      { title: "Aplicativo Mobile · USE MODA OS" },
      { name: "description", content: "App nativo para campo, fábrica e vendedores." },
    ],
  }),
  component: Mobile,
});

const features = [
  {
    icon: ScanLine,
    t: "Leitura de QR/Barcode",
    d: "Apontamento instantâneo em produção e estoque",
  },
  { icon: Wifi, t: "Modo offline", d: "Funciona sem conexão e sincroniza ao reconectar" },
  { icon: Bell, t: "Push em tempo real", d: "Notificações de pedidos, aprovações e alertas" },
  { icon: MapPin, t: "Geolocalização", d: "Check-in de visitas e roteiros de vendedores" },
];

function Mobile() {
  useRealtime("mobile_devices", ["mobile-devices"]);
  const { data } = useQuery({
    queryKey: ["mobile-devices"],
    queryFn: async () => {
      const { data } = await supabase.from("mobile_devices").select("id, app_version, active");
      return data ?? [];
    },
  });
  const total = data?.length ?? 0;
  const ativos = data?.filter((d) => d.active).length ?? 0;
  const versao = data?.[0]?.app_version ?? "2.4.1";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Smartphone className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aplicativo Mobile</h1>
          <p className="text-sm text-muted-foreground">
            App nativo iOS e Android para times em movimento
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-center">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Downloads", v: total.toLocaleString("pt-BR") },
              { l: "Avaliação", v: "4.8★" },
              { l: "Usuários ativos", v: ativos.toLocaleString("pt-BR") },
              { l: "Versão atual", v: versao },
            ].map((k) => (
              <div key={k.l} className="glass rounded-xl p-4">
                <div className="text-xs text-muted-foreground">{k.l}</div>
                <div className="text-xl font-semibold mt-1 tabular-nums">{k.v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.t} className="glass rounded-xl p-4 flex gap-3">
                  <div className="size-9 rounded-md bg-primary/15 text-primary grid place-items-center shrink-0">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{f.t}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{f.d}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="h-11 px-5 rounded-xl bg-foreground text-background inline-flex items-center gap-2 text-sm font-medium hover:opacity-90">
              <Apple className="size-5" /> App Store
            </button>
            <button className="h-11 px-5 rounded-xl bg-foreground text-background inline-flex items-center gap-2 text-sm font-medium hover:opacity-90">
              <Download className="size-5" /> Google Play
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[280px]">
          <div className="w-full aspect-[280/560] rounded-[40px] bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-[var(--shadow-elevated)] border border-white/10">
            <div className="w-full h-full rounded-[32px] bg-gradient-to-br from-background to-card overflow-hidden relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full" />
              <div className="pt-12 px-5">
                <div className="text-xs text-muted-foreground">Bem-vindo de volta</div>
                <div className="text-lg font-semibold mt-0.5">Ana Pereira</div>

                <div className="mt-5 rounded-2xl p-4 bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
                  <div className="text-xs opacity-80">Vendas do dia</div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">R$ 18.420</div>
                  <div className="text-xs opacity-80 mt-1">8 pedidos · 3 clientes</div>
                </div>

                <div className="mt-5 space-y-2">
                  {["Apontar produção", "Conferir estoque", "Novo pedido B2B"].map((t, i) => (
                    <div key={t} className="flex items-center gap-3 p-3 rounded-xl bg-muted/60">
                      <div className="size-8 rounded-lg bg-primary/15 text-primary grid place-items-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="text-sm font-medium">{t}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 text-warning fill-warning" /> 4.8
                  </span>
                  <span>v2.4.1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PushHistoryPanel />
    </div>
  );
}
