import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Plus, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · USE MODA OS" },
      { name: "description", content: "Pipeline de desenvolvimento de produtos." },
    ],
  }),
  component: ProdutosPage,
});

type Stage = "Briefing" | "Croqui" | "Modelagem" | "Protótipo" | "Aprovado";
const stages: Stage[] = ["Briefing", "Croqui", "Modelagem", "Protótipo", "Aprovado"];

const stageColor: Record<Stage, string> = {
  Briefing: "from-slate-500/40 to-slate-700/40",
  Croqui: "from-cyan-500/40 to-blue-600/40",
  Modelagem: "from-violet-500/40 to-purple-600/40",
  Protótipo: "from-amber-500/40 to-orange-600/40",
  Aprovado: "from-emerald-500/40 to-teal-600/40",
};

const products = [
  { id: "P-1041", name: "Vestido Midi Linho",     stage: "Aprovado" as Stage, collection: "Verão 26",  category: "Vestido",  cost: 89.50,  designer: "Marina S." },
  { id: "P-1042", name: "Blazer Oversized",       stage: "Protótipo" as Stage, collection: "Inverno 25", category: "Blazer", cost: 145.00, designer: "Carlos R." },
  { id: "P-1043", name: "Calça Wide Alfaiataria", stage: "Modelagem" as Stage, collection: "Resort 26", category: "Calça",   cost: 78.30,  designer: "Marina S." },
  { id: "P-1044", name: "Top Cropped Tricot",     stage: "Aprovado" as Stage, collection: "Verão 26",  category: "Top",     cost: 42.10,  designer: "Júlia M." },
  { id: "P-1045", name: "Saia Plissada Seda",     stage: "Croqui" as Stage,   collection: "Pre-Fall 26", category: "Saia",  cost: 112.00, designer: "Carlos R." },
  { id: "P-1046", name: "Jaqueta Couro Eco",      stage: "Briefing" as Stage, collection: "Inverno 25", category: "Jaqueta",cost: 198.00, designer: "Pedro L." },
  { id: "P-1047", name: "Bermuda Sarja",          stage: "Protótipo" as Stage, collection: "Verão 26", category: "Bermuda", cost: 56.40,  designer: "Júlia M." },
  { id: "P-1048", name: "Camisa Linho MC",        stage: "Aprovado" as Stage, collection: "Resort 26", category: "Camisa",  cost: 64.20,  designer: "Marina S." },
  { id: "P-1049", name: "Tricot Gola Alta",       stage: "Modelagem" as Stage, collection: "Inverno 25", category: "Tricot", cost: 87.90, designer: "Pedro L." },
  { id: "P-1050", name: "Macacão Pantalona",      stage: "Croqui" as Stage,   collection: "Pre-Fall 26", category: "Macacão", cost: 134.00, designer: "Marina S." },
];

function ProdutosPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [q, setQ] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Desenvolvimento de Produtos</h1>
            <p className="text-sm text-muted-foreground">{products.length} produtos em pipeline · 4 designers ativos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            <button onClick={() => setView("kanban")} className={`h-8 px-2 rounded text-xs inline-flex items-center gap-1.5 ${view==="kanban"?"bg-background text-foreground shadow-sm":"text-muted-foreground"}`}>
              <LayoutGrid className="size-3.5" /> Kanban
            </button>
            <button onClick={() => setView("list")} className={`h-8 px-2 rounded text-xs inline-flex items-center gap-1.5 ${view==="list"?"bg-background text-foreground shadow-sm":"text-muted-foreground"}`}>
              <ListIcon className="size-3.5" /> Lista
            </button>
          </div>
          <button className="h-9 px-4 rounded-md text-sm font-medium bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 transition-opacity inline-flex items-center gap-2">
            <Plus className="size-4" /> Novo produto
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nome ou código…"
          className="w-full h-9 pl-8 pr-3 rounded-md bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {stages.map((s) => {
            const items = filtered.filter((p) => p.stage === s);
            return (
              <div key={s} className="glass rounded-xl p-3 min-h-[400px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="text-sm font-semibold">{s}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{items.length}</div>
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <div key={p.id} className="bg-card rounded-lg p-3 border border-border hover:border-primary/40 transition-colors cursor-pointer">
                      <div className={`h-20 rounded-md mb-3 bg-gradient-to-br ${stageColor[s]}`} />
                      <div className="text-xs text-muted-foreground tabular-nums">{p.id}</div>
                      <div className="text-sm font-medium leading-tight mt-0.5">{p.name}</div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{p.collection}</span>
                        <span className="tabular-nums text-foreground/80">R$ {p.cost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Código</th>
                <th className="text-left font-medium px-4 py-3">Produto</th>
                <th className="text-left font-medium px-4 py-3">Coleção</th>
                <th className="text-left font-medium px-4 py-3">Categoria</th>
                <th className="text-left font-medium px-4 py-3">Etapa</th>
                <th className="text-left font-medium px-4 py-3">Designer</th>
                <th className="text-right font-medium px-4 py-3">Custo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.id}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.collection}</td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-primary/15 text-primary">{p.stage}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.designer}</td>
                  <td className="px-4 py-3 text-right tabular-nums">R$ {p.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
