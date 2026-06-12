import { createFileRoute } from "@tanstack/react-router";
import { Boxes, AlertTriangle, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/almoxarifado")({
  head: () => ({
    meta: [
      { title: "Almoxarifado · USE MODA OS" },
      { name: "description", content: "Estoque de tecidos, aviamentos e produtos acabados." },
    ],
  }),
  component: Almoxarifado,
});

const itens = [
  { sku: "TEC-0042", nome: "Linho 100% natural areia",   cat: "Tecido",    saldo: 142.5, un: "m",  minimo: 100, deposito: "DP-01" },
  { sku: "TEC-0043", nome: "Viscose ecológica preta",    cat: "Tecido",    saldo: 38.0,  un: "m",  minimo: 80,  deposito: "DP-01" },
  { sku: "TEC-0044", nome: "Malha algodão pima off",     cat: "Tecido",    saldo: 12.0,  un: "kg", minimo: 50,  deposito: "DP-02" },
  { sku: "AV-0210",  nome: "Zíper invisível 50cm preto", cat: "Aviamento", saldo: 1820,  un: "un", minimo: 500, deposito: "DP-03" },
  { sku: "AV-0211",  nome: "Botão polyester 12mm",       cat: "Aviamento", saldo: 4250,  un: "un", minimo: 1000, deposito: "DP-03" },
  { sku: "AC-1042",  nome: "Vestido Midi Linho (M)",     cat: "Acabado",   saldo: 84,    un: "un", minimo: 50,  deposito: "DP-04" },
  { sku: "AC-1043",  nome: "Blazer Oversized (G)",       cat: "Acabado",   saldo: 22,    un: "un", minimo: 30,  deposito: "DP-04" },
  { sku: "AV-0212",  nome: "Etiqueta composição padrão", cat: "Aviamento", saldo: 8400,  un: "un", minimo: 2000, deposito: "DP-03" },
];

function Almoxarifado() {
  const [q, setQ] = useState("");
  const filtered = itens.filter((i) => i.nome.toLowerCase().includes(q.toLowerCase()) || i.sku.includes(q.toUpperCase()));
  const criticos = itens.filter((i) => i.saldo < i.minimo).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Boxes className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Almoxarifado</h1>
          <p className="text-sm text-muted-foreground">4 depósitos · {itens.length} SKUs · {criticos} em nível crítico</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "SKUs ativos", v: "1.847" },
          { l: "Valor em estoque", v: "R$ 2.4M" },
          { l: "Giro médio", v: "42 dias" },
          { l: "Críticos", v: String(criticos), warn: true },
        ].map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className={`text-2xl font-semibold mt-1 tabular-nums ${k.warn ? "text-destructive" : ""}`}>{k.v}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">Inventário</div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar SKU ou nome…"
              className="w-72 h-9 pl-8 pr-3 rounded-md bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">SKU</th>
              <th className="text-left font-medium px-5 py-2.5">Item</th>
              <th className="text-left font-medium px-5 py-2.5">Categoria</th>
              <th className="text-left font-medium px-5 py-2.5">Depósito</th>
              <th className="text-right font-medium px-5 py-2.5">Saldo</th>
              <th className="text-right font-medium px-5 py-2.5">Mínimo</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const critico = i.saldo < i.minimo;
              return (
                <tr key={i.sku} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">{i.sku}</td>
                  <td className="px-5 py-3 font-medium">{i.nome}</td>
                  <td className="px-5 py-3 text-muted-foreground">{i.cat}</td>
                  <td className="px-5 py-3 text-muted-foreground">{i.deposito}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${critico ? "text-destructive font-medium" : ""}`}>{i.saldo} {i.un}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{i.minimo} {i.un}</td>
                  <td className="px-5 py-3">
                    {critico
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive"><AlertTriangle className="size-3" /> Crítico</span>
                      : <span className="px-2 py-0.5 rounded text-xs bg-success/15 text-success">Ok</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
