import { createFileRoute } from "@tanstack/react-router";
import { FileText, Sparkles, Download, History, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/ficha-tecnica")({
  head: () => ({
    meta: [
      { title: "Ficha Técnica · USE MODA OS" },
      { name: "description", content: "Tech packs inteligentes gerados com IA." },
    ],
  }),
  component: FichaPage,
});

const fichas = [
  { id: "FT-2041", produto: "Vestido Midi Linho",  versao: "v3.2", status: "Aprovada", autor: "Marina S.", data: "12/06" },
  { id: "FT-2042", produto: "Blazer Oversized",    versao: "v1.4", status: "Em revisão", autor: "Carlos R.", data: "11/06" },
  { id: "FT-2043", produto: "Calça Wide Alfaiataria", versao: "v2.0", status: "Aprovada", autor: "Marina S.", data: "10/06" },
  { id: "FT-2044", produto: "Top Cropped Tricot",  versao: "v1.1", status: "Rascunho", autor: "Júlia M.", data: "09/06" },
  { id: "FT-2045", produto: "Camisa Linho MC",     versao: "v2.3", status: "Aprovada", autor: "Marina S.", data: "08/06" },
];

const materiais = [
  { item: "Linho 100% natural",          consumo: "1.45 m", custo: 38.50, fornecedor: "Tecidos Paulista" },
  { item: "Forro viscose",               consumo: "0.80 m", custo: 9.20,  fornecedor: "Forros & Cia" },
  { item: "Zíper invisível 50cm",        consumo: "1 un",   custo: 4.80,  fornecedor: "Aviamentos Brasil" },
  { item: "Botão polyester 12mm",        consumo: "4 un",   custo: 2.40,  fornecedor: "Aviamentos Brasil" },
  { item: "Etiqueta composição",         consumo: "1 un",   custo: 0.60,  fornecedor: "Etiquetas SP" },
];

const medidas = [
  { ponto: "Busto",         pp: 84, p: 88, m: 92, g: 96, gg: 100 },
  { ponto: "Cintura",       pp: 66, p: 70, m: 74, g: 78, gg: 82 },
  { ponto: "Quadril",       pp: 90, p: 94, m: 98, g: 102, gg: 106 },
  { ponto: "Comprimento",   pp: 110, p: 112, m: 114, g: 116, gg: 118 },
  { ponto: "Cava",          pp: 22, p: 23, m: 24, g: 25, gg: 26 },
];

function FichaPage() {
  const [selected, setSelected] = useState(fichas[0]);
  const custoTotal = materiais.reduce((s, m) => s + m.custo, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <FileText className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ficha Técnica Inteligente</h1>
          <p className="text-sm text-muted-foreground">Tech packs versionados e gerados com IA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <div className="glass rounded-xl p-3 h-fit">
          <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">Fichas recentes</div>
          <div className="space-y-1">
            {fichas.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${selected.id===f.id?"bg-primary/10 border border-primary/30":"hover:bg-muted/60 border border-transparent"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium tabular-nums text-muted-foreground">{f.id}</div>
                  <div className="text-[10px] text-muted-foreground">{f.versao}</div>
                </div>
                <div className="text-sm font-medium mt-0.5">{f.produto}</div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                  <span>{f.autor}</span>
                  <span className={`px-1.5 py-0.5 rounded ${f.status==="Aprovada"?"bg-success/15 text-success":f.status==="Em revisão"?"bg-warning/15 text-warning":"bg-muted text-muted-foreground"}`}>{f.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground tabular-nums">{selected.id} · {selected.versao}</div>
                <h2 className="text-xl font-semibold mt-0.5">{selected.produto}</h2>
                <div className="text-sm text-muted-foreground mt-1">Atualizada por {selected.autor} em {selected.data} · <span className="text-success inline-flex items-center gap-1"><CheckCircle2 className="size-3.5"/>{selected.status}</span></div>
              </div>
              <div className="flex gap-2">
                <button className="h-9 px-3 rounded-md text-sm bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5"><History className="size-4" /> Versões</button>
                <button className="h-9 px-3 rounded-md text-sm bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5"><Download className="size-4" /> PDF</button>
                <button className="h-9 px-3 rounded-md text-sm bg-[image:var(--gradient-primary)] text-primary-foreground inline-flex items-center gap-1.5"><Sparkles className="size-4" /> Gerar com IA</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Custo de materiais</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">R$ {custoTotal.toFixed(2)}</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Tempo de confecção</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">48 min</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Preço sugerido</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums text-gradient">R$ 289,90</div>
            </div>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-sm font-semibold">Lista de materiais (BOM)</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2">Item</th>
                  <th className="text-left font-medium px-5 py-2">Consumo</th>
                  <th className="text-left font-medium px-5 py-2">Fornecedor</th>
                  <th className="text-right font-medium px-5 py-2">Custo</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((m) => (
                  <tr key={m.item} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{m.item}</td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{m.consumo}</td>
                    <td className="px-5 py-3 text-muted-foreground">{m.fornecedor}</td>
                    <td className="px-5 py-3 text-right tabular-nums">R$ {m.custo.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-sm font-semibold">Tabela de medidas (cm)</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2">Ponto</th>
                  <th className="text-right font-medium px-5 py-2">PP</th>
                  <th className="text-right font-medium px-5 py-2">P</th>
                  <th className="text-right font-medium px-5 py-2">M</th>
                  <th className="text-right font-medium px-5 py-2">G</th>
                  <th className="text-right font-medium px-5 py-2">GG</th>
                </tr>
              </thead>
              <tbody>
                {medidas.map((m) => (
                  <tr key={m.ponto} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{m.ponto}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{m.pp}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{m.p}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{m.m}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{m.g}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{m.gg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
