import { createFileRoute } from "@tanstack/react-router";
import { PenTool, Download, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/cad")({
  head: () => ({
    meta: [
      { title: "CAD e Modelagem · USE MODA OS" },
      { name: "description", content: "Biblioteca de moldes e modelagem digital." },
    ],
  }),
  component: CAD,
});

const moldes = [
  { id: "MD-0421", nome: "Base Vestido Midi",     versao: "v4.1", grade: "PP-GG", consumo: "1.45m", autor: "Marina S.", gradient: "from-rose-400/40 to-pink-600/40" },
  { id: "MD-0422", nome: "Base Blazer Oversized", versao: "v2.8", grade: "PP-GG", consumo: "2.10m", autor: "Carlos R.", gradient: "from-violet-400/40 to-indigo-600/40" },
  { id: "MD-0423", nome: "Base Calça Wide",       versao: "v3.2", grade: "PP-GG", consumo: "1.80m", autor: "Marina S.", gradient: "from-cyan-400/40 to-teal-600/40" },
  { id: "MD-0424", nome: "Base Top Cropped",      versao: "v1.5", grade: "PP-G",  consumo: "0.60m", autor: "Júlia M.",  gradient: "from-amber-400/40 to-orange-600/40" },
  { id: "MD-0425", nome: "Base Saia Plissada",    versao: "v2.1", grade: "PP-GG", consumo: "1.20m", autor: "Pedro L.",  gradient: "from-emerald-400/40 to-green-600/40" },
  { id: "MD-0426", nome: "Base Camisa Linho",     versao: "v3.0", grade: "PP-GG", consumo: "1.40m", autor: "Marina S.", gradient: "from-sky-400/40 to-blue-600/40" },
  { id: "MD-0427", nome: "Base Bermuda Sarja",    versao: "v1.8", grade: "PP-GG", consumo: "1.10m", autor: "Júlia M.",  gradient: "from-stone-400/40 to-zinc-600/40" },
  { id: "MD-0428", nome: "Base Macacão",          versao: "v1.2", grade: "PP-G",  consumo: "2.40m", autor: "Carlos R.", gradient: "from-fuchsia-400/40 to-purple-600/40" },
];

function CAD() {
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
        {[
          { l: "Moldes ativos", v: "428" },
          { l: "Versões totais", v: "1.842" },
          { l: "Modelistas", v: "6" },
          { l: "Encaixes salvos", v: "284" },
        ].map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {moldes.map((m) => (
          <div key={m.id} className="glass rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
            <div className={`h-32 bg-gradient-to-br ${m.gradient} relative`}>
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M20,10 L80,10 L70,90 L30,90 Z" fill="none" stroke="white" strokeWidth="0.5" />
                <path d="M30,30 L70,30" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" />
                <path d="M28,60 L72,60" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" />
              </svg>
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] text-white tabular-nums">{m.versao}</div>
            </div>
            <div className="p-4">
              <div className="text-xs text-muted-foreground tabular-nums">{m.id}</div>
              <div className="font-medium text-sm mt-0.5 leading-tight">{m.nome}</div>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>Grade</span><span className="text-foreground/80 tabular-nums">{m.grade}</span></div>
                <div className="flex justify-between"><span>Consumo</span><span className="text-foreground/80 tabular-nums">{m.consumo}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex-1 h-8 rounded-md bg-muted text-xs hover:bg-muted/70 inline-flex items-center justify-center gap-1.5"><Eye className="size-3.5" /> Abrir</button>
                <button className="size-8 rounded-md bg-muted hover:bg-muted/70 grid place-items-center text-muted-foreground"><Download className="size-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
