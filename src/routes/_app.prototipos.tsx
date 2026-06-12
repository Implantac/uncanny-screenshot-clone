import { createFileRoute } from "@tanstack/react-router";
import { Scissors, CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_app/prototipos")({
  head: () => ({
    meta: [
      { title: "Protótipos · USE MODA OS" },
      { name: "description", content: "Ciclo de protótipos, provas e aprovações." },
    ],
  }),
  component: Prototipos,
});

type Etapa = "Solicitado" | "Em confecção" | "Em prova" | "Aprovado" | "Reprovado";
const etapas: Etapa[] = ["Solicitado", "Em confecção", "Em prova", "Aprovado", "Reprovado"];

const items: Array<{ id: string; produto: string; faccao: string; etapa: Etapa; prazo: string }> = [
  { id: "PT-820", produto: "Vestido Midi Linho",     faccao: "Santos & Cia",    etapa: "Aprovado",     prazo: "08/06" },
  { id: "PT-821", produto: "Blazer Oversized",       faccao: "Confecção Lopes", etapa: "Em prova",     prazo: "14/06" },
  { id: "PT-822", produto: "Calça Wide Alfaiataria", faccao: "Costura RS",      etapa: "Em confecção", prazo: "18/06" },
  { id: "PT-823", produto: "Top Cropped",            faccao: "Atelier Norte",   etapa: "Solicitado",   prazo: "22/06" },
  { id: "PT-824", produto: "Saia Plissada Seda",     faccao: "Santos & Cia",    etapa: "Em prova",     prazo: "15/06" },
  { id: "PT-825", produto: "Macacão Pantalona",      faccao: "Confecção Lopes", etapa: "Reprovado",    prazo: "10/06" },
  { id: "PT-826", produto: "Camisa Linho MC",        faccao: "Atelier Norte",   etapa: "Aprovado",     prazo: "07/06" },
  { id: "PT-827", produto: "Tricot Gola Alta",       faccao: "Costura RS",      etapa: "Em confecção", prazo: "20/06" },
];

const etapaStyle: Record<Etapa, string> = {
  "Solicitado":    "from-slate-500/30 to-slate-700/30",
  "Em confecção":  "from-cyan-500/30 to-blue-600/30",
  "Em prova":      "from-amber-500/30 to-orange-600/30",
  "Aprovado":      "from-emerald-500/30 to-teal-600/30",
  "Reprovado":     "from-rose-500/30 to-red-600/30",
};

function Prototipos() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Scissors className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Protótipos</h1>
          <p className="text-sm text-muted-foreground">Ciclo de provas, ajustes e aprovações</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Em andamento", v: String(items.filter(i=>i.etapa!=="Aprovado"&&i.etapa!=="Reprovado").length), i: Clock, c: "text-info" },
          { l: "Aprovados (mês)", v: String(items.filter(i=>i.etapa==="Aprovado").length), i: CheckCircle2, c: "text-success" },
          { l: "Reprovados", v: String(items.filter(i=>i.etapa==="Reprovado").length), i: XCircle, c: "text-destructive" },
          { l: "Lead time médio", v: "9 dias", i: Clock, c: "text-primary" },
        ].map((k) => {
          const Icon = k.i;
          return (
            <div key={k.l} className="glass rounded-xl p-5">
              <Icon className={`size-5 ${k.c}`} />
              <div className="text-2xl font-semibold mt-3 tabular-nums">{k.v}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.l}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {etapas.map((et) => {
          const cards = items.filter((i) => i.etapa === et);
          return (
            <div key={et} className="glass rounded-xl p-3 min-h-[280px]">
              <div className="flex items-center justify-between px-1 mb-3">
                <div className="text-sm font-semibold">{et}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{cards.length}</div>
              </div>
              <div className="space-y-2">
                {cards.map((c) => (
                  <div key={c.id} className="bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors cursor-pointer">
                    <div className={`h-16 rounded-md mb-2 bg-gradient-to-br ${etapaStyle[et]}`} />
                    <div className="text-xs text-muted-foreground tabular-nums">{c.id}</div>
                    <div className="text-sm font-medium mt-0.5 leading-tight">{c.produto}</div>
                    <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                      <span className="truncate">{c.faccao}</span>
                      <span className="tabular-nums shrink-0 ml-2">{c.prazo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
