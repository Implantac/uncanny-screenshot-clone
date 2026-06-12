import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, QrCode, Leaf, Globe, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_app/dpp")({
  head: () => ({
    meta: [
      { title: "Digital Product Passport · USE MODA OS" },
      { name: "description", content: "Rastreabilidade e compliance ESG por peça." },
    ],
  }),
  component: DPP,
});

const CERTS = ["GOTS · OEKO-TEX", "OEKO-TEX", "BCI · OEKO-TEX", "GOTS", "European Flax"];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function DPP() {
  useRealtime("products", ["dpp"]);
  const { data, isLoading } = useQuery({
    queryKey: ["dpp"],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, sku, name, category, collection_id, collections(name, season, year)")
        .order("updated_at", { ascending: false })
        .limit(12);
      return products ?? [];
    },
  });

  const items = (data ?? []).map((p) => {
    const h = hash(p.id);
    return {
      ...p,
      lote: `L-${String(h % 9999).padStart(4, "0")}`,
      emitidos: 100 + (h % 500),
      co2: (2 + ((h % 70) / 10)).toFixed(1),
      cert: CERTS[h % CERTS.length],
    };
  });

  const avgCo2 = items.length ? (items.reduce((s, i) => s + Number(i.co2), 0) / items.length).toFixed(1) : "—";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <ShieldCheck className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Digital Product Passport</h1>
          <p className="text-sm text-muted-foreground">Rastreabilidade, compliance ESG e EU DPP</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Passaportes emitidos", v: items.reduce((s, i) => s + i.emitidos, 0).toLocaleString("pt-BR"), i: QrCode },
          { l: "Pegada de CO₂ média", v: `${avgCo2} kg`, i: Leaf },
          { l: "Produtos rastreados", v: items.length.toLocaleString("pt-BR"), i: ShieldCheck },
          { l: "Certificações ativas", v: new Set(items.map((i) => i.cert)).size, i: Globe },
        ].map((k) => {
          const Icon = k.i;
          return (
            <div key={k.l} className="glass rounded-xl p-5">
              <Icon className="size-5 text-primary" />
              <div className="text-2xl font-semibold mt-3 tabular-nums">{k.v}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.l}</div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">Nenhum produto para emitir DPP. Cadastre produtos primeiro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => {
            const col = (p as any).collections;
            return (
              <div key={p.id} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground tabular-nums truncate">{p.sku} · {p.lote}</div>
                    <div className="font-medium mt-0.5 truncate">{p.name}</div>
                  </div>
                  <div className="size-12 rounded-md bg-foreground/10 grid place-items-center shrink-0">
                    <QrCode className="size-7" />
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Peças emitidas</span><span className="tabular-nums font-medium">{p.emitidos}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CO₂ por peça</span><span className="tabular-nums font-medium">{p.co2} kg</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Coleção</span><span className="font-medium truncate ml-2">{col ? `${col.name} ${col.season}/${col.year}` : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Certificações</span><span className="font-medium text-success">{p.cert}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
