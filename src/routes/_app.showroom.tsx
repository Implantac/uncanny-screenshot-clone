import { createFileRoute } from "@tanstack/react-router";
import { MonitorPlay, Eye, Heart, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_app/showroom")({
  head: () => ({
    meta: [
      { title: "Showroom Digital · USE MODA OS" },
      { name: "description", content: "Lookbooks interativos e showroom virtual." },
    ],
  }),
  component: Showroom,
});

const lookbooks = [
  { nome: "Verão 26 — Mediterrâneo",     looks: 24, views: 1842, likes: 412, pedidos: 38, gradient: "from-orange-400/50 to-pink-500/50" },
  { nome: "Resort 26 — Costa Azul",      looks: 18, views: 1240, likes: 318, pedidos: 24, gradient: "from-cyan-400/50 to-blue-600/50" },
  { nome: "Inverno 25 — Highland",       looks: 32, views: 980,  likes: 264, pedidos: 42, gradient: "from-indigo-500/50 to-purple-700/50" },
  { nome: "Pre-Fall 26 — Urbano",        looks: 16, views: 624,  likes: 142, pedidos: 12, gradient: "from-stone-500/50 to-zinc-700/50" },
  { nome: "Cápsula Praia — Pareo",       looks: 12, views: 1420, likes: 380, pedidos: 28, gradient: "from-yellow-300/50 to-rose-500/50" },
  { nome: "Cápsula Festa — Glow",        looks: 14, views: 1820, likes: 524, pedidos: 46, gradient: "from-fuchsia-500/50 to-violet-700/50" },
];

function Showroom() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <MonitorPlay className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Showroom Digital</h1>
          <p className="text-sm text-muted-foreground">Lookbooks interativos e vitrine virtual</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lookbooks.map((l) => (
          <div key={l.nome} className="glass rounded-xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer">
            <div className={`relative h-44 bg-gradient-to-br ${l.gradient}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.18),transparent_60%)]" />
              <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="size-14 rounded-full bg-white/20 backdrop-blur grid place-items-center">
                  <MonitorPlay className="size-6 text-white" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] text-white tabular-nums">{l.looks} looks</div>
            </div>
            <div className="p-4">
              <div className="font-medium">{l.nome}</div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /><span className="tabular-nums">{l.views}</span></span>
                <span className="inline-flex items-center gap-1"><Heart className="size-3.5" /><span className="tabular-nums">{l.likes}</span></span>
                <span className="inline-flex items-center gap-1 text-success"><ShoppingCart className="size-3.5" /><span className="tabular-nums">{l.pedidos}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
