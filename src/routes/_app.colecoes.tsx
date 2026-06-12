import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Plus, Calendar, Users, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/colecoes")({
  head: () => ({
    meta: [
      { title: "Coleções · USE MODA OS" },
      { name: "description", content: "Gerencie coleções, linhas e calendário sazonal." },
    ],
  }),
  component: ColecoesPage,
});

type Status = "Briefing" | "Em desenvolvimento" | "Finalizando" | "Em produção" | "Entregue";

const statusStyle: Record<Status, string> = {
  "Briefing":            "bg-muted text-muted-foreground",
  "Em desenvolvimento":  "bg-info/15 text-info",
  "Finalizando":         "bg-warning/15 text-warning",
  "Em produção":         "bg-primary/15 text-primary",
  "Entregue":            "bg-success/15 text-success",
};

const collections: Array<{
  id: string; name: string; season: string; status: Status; pieces: number;
  progress: number; team: number; deadline: string; gradient: string;
}> = [
  { id: "c1", name: "Verão 26",     season: "SS26",   status: "Em desenvolvimento", pieces: 142, progress: 78, team: 12, deadline: "15/08/2025", gradient: "from-pink-500/40 to-orange-400/40" },
  { id: "c2", name: "Resort 26",    season: "RS26",   status: "Finalizando",        pieces: 86,  progress: 92, team: 8,  deadline: "30/06/2025", gradient: "from-cyan-500/40 to-blue-500/40" },
  { id: "c3", name: "Inverno 25",   season: "AW25",   status: "Em produção",        pieces: 218, progress: 100, team: 18, deadline: "10/06/2025", gradient: "from-indigo-500/40 to-purple-500/40" },
  { id: "c4", name: "Pre-Fall 26",  season: "PF26",   status: "Briefing",           pieces: 64,  progress: 24, team: 5,  deadline: "20/09/2025", gradient: "from-emerald-500/40 to-teal-500/40" },
  { id: "c5", name: "Cápsula Praia",season: "Drop",   status: "Em desenvolvimento", pieces: 32,  progress: 55, team: 4,  deadline: "05/07/2025", gradient: "from-yellow-400/40 to-rose-500/40" },
  { id: "c6", name: "Outono 25",    season: "AU25",   status: "Entregue",           pieces: 156, progress: 100, team: 14, deadline: "01/03/2025", gradient: "from-amber-600/40 to-red-600/40" },
];

function ColecoesPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "Todas">("Todas");

  const visible = collections.filter((c) =>
    (filter === "Todas" || c.status === filter) &&
    (q === "" || c.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Layers className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gestão de Coleções</h1>
            <p className="text-sm text-muted-foreground">{collections.length} coleções · {collections.reduce((s,c)=>s+c.pieces,0)} peças no total</p>
          </div>
        </div>
        <button className="h-9 px-4 rounded-md text-sm font-medium bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 transition-opacity inline-flex items-center gap-2">
          <Plus className="size-4" /> Nova coleção
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar coleção…"
            className="w-full h-9 pl-8 pr-3 rounded-md bg-muted/60 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["Todas", "Briefing", "Em desenvolvimento", "Finalizando", "Em produção", "Entregue"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((c) => (
          <Link key={c.id} to="/colecoes" className="glass rounded-xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group">
            <div className={`relative h-32 bg-gradient-to-br ${c.gradient}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/30 backdrop-blur text-[10px] font-medium uppercase tracking-widest text-white/90">
                {c.season}
              </div>
              <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-medium ${statusStyle[c.status]}`}>
                {c.status}
              </div>
              <div className="absolute bottom-3 left-3 text-white">
                <div className="text-lg font-semibold leading-tight">{c.name}</div>
                <div className="text-xs text-white/80">{c.pieces} peças</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium tabular-nums">{c.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-[image:var(--gradient-primary)] transition-all" style={{ width: `${c.progress}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" />{c.deadline}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{c.team} pessoas</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
