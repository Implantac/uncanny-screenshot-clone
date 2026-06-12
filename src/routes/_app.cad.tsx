import { createFileRoute } from "@tanstack/react-router";
import { PenTool, Download, Eye, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_app/cad")({
  head: () => ({
    meta: [
      { title: "CAD e Modelagem · USE MODA OS" },
      { name: "description", content: "Biblioteca de moldes e modelagem digital." },
    ],
  }),
  component: CAD,
});

const GRADIENTS = [
  "from-rose-400/40 to-pink-600/40",
  "from-violet-400/40 to-indigo-600/40",
  "from-cyan-400/40 to-teal-600/40",
  "from-amber-400/40 to-orange-600/40",
  "from-emerald-400/40 to-green-600/40",
  "from-sky-400/40 to-blue-600/40",
  "from-stone-400/40 to-zinc-600/40",
  "from-fuchsia-400/40 to-purple-600/40",
];

function CAD() {
  useRealtime("products", ["cad-products"]);
  const { data, isLoading } = useQuery({
    queryKey: ["cad-products"],
    queryFn: async () => {
      const [{ data: products }, { count: protoCount }] = await Promise.all([
        supabase.from("products").select("id, sku, name, category, sizes, image_url, updated_at").order("updated_at", { ascending: false }).limit(24),
        supabase.from("prototypes").select("id", { count: "exact", head: true }),
      ]);
      return { products: products ?? [], protoCount: protoCount ?? 0 };
    },
  });

  const moldes = data?.products ?? [];
  const kpis = [
    { l: "Moldes ativos", v: moldes.length.toLocaleString("pt-BR") },
    { l: "Protótipos", v: (data?.protoCount ?? 0).toLocaleString("pt-BR") },
    { l: "Categorias", v: new Set(moldes.map((m) => m.category).filter(Boolean)).size },
    { l: "Atualizações 30d", v: moldes.filter((m) => new Date(m.updated_at).getTime() > Date.now() - 30 * 864e5).length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <PenTool className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CAD e Modelagem</h1>
          <p className="text-sm text-muted-foreground">Biblioteca de moldes · integração Audaces / Optitex</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 grid place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : moldes.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">
          Nenhum molde cadastrado ainda. Crie produtos para alimentar a biblioteca.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {moldes.map((m, i) => {
            const grade = (m.sizes ?? []).length ? `${m.sizes![0]}-${m.sizes![m.sizes!.length - 1]}` : "—";
            return (
              <div key={m.id} className="glass rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
                <div className={`h-32 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} relative`}>
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-80" loading="lazy" />
                  ) : (
                    <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M20,10 L80,10 L70,90 L30,90 Z" fill="none" stroke="white" strokeWidth="0.5" />
                      <path d="M30,30 L70,30" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" />
                      <path d="M28,60 L72,60" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" />
                    </svg>
                  )}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] text-white tabular-nums">{m.category ?? "—"}</div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground tabular-nums">{m.sku}</div>
                  <div className="font-medium text-sm mt-0.5 leading-tight truncate">{m.name}</div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Grade</span><span className="text-foreground/80 tabular-nums">{grade}</span></div>
                    <div className="flex justify-between"><span>Cores</span><span className="text-foreground/80 tabular-nums">{(m as any).colors?.length ?? 0}</span></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 h-8 rounded-md bg-muted text-xs hover:bg-muted/70 inline-flex items-center justify-center gap-1.5"><Eye className="size-3.5" /> Abrir</button>
                    <button className="size-8 rounded-md bg-muted hover:bg-muted/70 grid place-items-center text-muted-foreground"><Download className="size-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
