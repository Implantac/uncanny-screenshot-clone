import { createFileRoute } from "@tanstack/react-router";
import { MonitorPlay, Eye, Heart, ShoppingCart, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/showroom")({
  head: () => ({
    meta: [
      { title: "Showroom Digital · USE MODA OS" },
      { name: "description", content: "Lookbooks interativos e showroom virtual." },
    ],
  }),
  component: Showroom,
});

const GRADIENTS = [
  "from-orange-400/50 to-pink-500/50",
  "from-cyan-400/50 to-blue-600/50",
  "from-indigo-500/50 to-purple-700/50",
  "from-stone-500/50 to-zinc-700/50",
  "from-yellow-300/50 to-rose-500/50",
  "from-fuchsia-500/50 to-violet-700/50",
];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function Showroom() {
  useRealtime("collections", ["showroom"]);
  const { data, isLoading } = useQuery({
    queryKey: ["showroom"],
    queryFn: async () => {
      const { data: cols } = await supabase
        .from("collections")
        .select("id, name, season, year, status, progress, cover_url, palette")
        .order("created_at", { ascending: false })
        .limit(12);
      if (!cols?.length) return [];
      const ids = cols.map((c) => c.id);
      const { data: prods } = await supabase.from("products").select("collection_id").in("collection_id", ids);
      const counts = new Map<string, number>();
      (prods ?? []).forEach((p) => counts.set(p.collection_id!, (counts.get(p.collection_id!) ?? 0) + 1));
      return cols.map((c) => ({ ...c, looks: counts.get(c.id) ?? 0 }));
    },
  });

  const items = data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <MonitorPlay className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Showroom Digital</h1>
          <p className="text-sm text-muted-foreground">Lookbooks interativos e vitrine virtual</p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">Nenhuma coleção para exibir. Crie uma coleção primeiro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((l, i) => {
            const h = hash(l.id);
            const views = 200 + (h % 2000);
            const likes = 40 + (h % 500);
            const pedidos = 5 + (h % 50);
            return (
              <div key={l.id} className="glass rounded-xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer">
                <div className={`relative h-44 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}>
                  {l.cover_url && <img src={l.cover_url} alt={l.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.18),transparent_60%)]" />
                  <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="size-14 rounded-full bg-white/20 backdrop-blur grid place-items-center">
                      <MonitorPlay className="size-6 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] text-white tabular-nums">{l.looks} looks</div>
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] text-white">{l.season} {l.year}</div>
                </div>
                <div className="p-4">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /><span className="tabular-nums">{views}</span></span>
                    <span className="inline-flex items-center gap-1"><Heart className="size-3.5" /><span className="tabular-nums">{likes}</span></span>
                    <span className="inline-flex items-center gap-1 text-success"><ShoppingCart className="size-3.5" /><span className="tabular-nums">{pedidos}</span></span>
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
