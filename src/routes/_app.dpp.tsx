import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, QrCode, Leaf, Globe } from "lucide-react";

export const Route = createFileRoute("/_app/dpp")({
  head: () => ({
    meta: [
      { title: "Digital Product Passport · USE MODA OS" },
      { name: "description", content: "Rastreabilidade e compliance ESG por peça." },
    ],
  }),
  component: DPP,
});

const passaportes = [
  { id: "DPP-9821", produto: "Vestido Midi Linho",  lote: "L-0421", emitidos: 320, co2: 4.2, origem: "Brasil",  cert: "GOTS · OEKO-TEX" },
  { id: "DPP-9822", produto: "Blazer Oversized",    lote: "L-0418", emitidos: 180, co2: 8.6, origem: "Brasil",  cert: "OEKO-TEX" },
  { id: "DPP-9823", produto: "Calça Wide",          lote: "L-0419", emitidos: 240, co2: 5.1, origem: "Brasil",  cert: "BCI · OEKO-TEX" },
  { id: "DPP-9824", produto: "Top Cropped",         lote: "L-0420", emitidos: 500, co2: 2.8, origem: "Brasil",  cert: "GOTS" },
  { id: "DPP-9825", produto: "Camisa Linho MC",     lote: "L-0422", emitidos: 280, co2: 3.6, origem: "Portugal",cert: "European Flax" },
];

function DPP() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
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
          { l: "Passaportes emitidos", v: "1.520", i: QrCode },
          { l: "Pegada de CO₂ média", v: "4.9 kg", i: Leaf },
          { l: "% material certificado", v: "78%", i: ShieldCheck },
          { l: "Países de origem", v: "6", i: Globe },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {passaportes.map((p) => (
          <div key={p.id} className="glass rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground tabular-nums">{p.id} · {p.lote}</div>
                <div className="font-medium mt-0.5">{p.produto}</div>
              </div>
              <div className="size-12 rounded-md bg-foreground/10 grid place-items-center">
                <QrCode className="size-7" />
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Peças emitidas</span><span className="tabular-nums font-medium">{p.emitidos}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CO₂ por peça</span><span className="tabular-nums font-medium">{p.co2} kg</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Origem</span><span className="font-medium">{p.origem}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Certificações</span><span className="font-medium text-success">{p.cert}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
