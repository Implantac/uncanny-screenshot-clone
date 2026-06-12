import { createFileRoute } from "@tanstack/react-router";
import { Factory, Play, Pause, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/pcp")({
  head: () => ({
    meta: [
      { title: "PCP e Produção · USE MODA OS" },
      { name: "description", content: "Planejamento, ordens de produção e capacidade." },
    ],
  }),
  component: PCP,
});

const ordens = [
  { id: "OP-4821", produto: "Vestido Midi Linho", qtd: 320, faccao: "Santos & Cia", prog: 64, prazo: "18/06", status: "Em produção" as const },
  { id: "OP-4822", produto: "Blazer Oversized",   qtd: 180, faccao: "Confecção Lopes", prog: 100, prazo: "10/06", status: "Concluída" as const },
  { id: "OP-4823", produto: "Calça Wide",         qtd: 240, faccao: "Costura RS",      prog: 32, prazo: "25/06", status: "Em produção" as const },
  { id: "OP-4824", produto: "Top Cropped",        qtd: 500, faccao: "Santos & Cia",    prog: 12, prazo: "30/06", status: "Atrasada" as const },
  { id: "OP-4825", produto: "Saia Plissada",      qtd: 150, faccao: "Confecção Lopes", prog: 0,  prazo: "05/07", status: "Aguardando" as const },
];

const capacidade = [
  { f: "Santos & Cia",    capacidade: 100, usado: 92 },
  { f: "Confecção Lopes", capacidade: 100, usado: 68 },
  { f: "Costura RS",      capacidade: 100, usado: 45 },
  { f: "Atelier Norte",   capacidade: 100, usado: 78 },
];

const statusStyle = {
  "Em produção": "bg-info/15 text-info",
  "Concluída":   "bg-success/15 text-success",
  "Atrasada":    "bg-destructive/15 text-destructive",
  "Aguardando":  "bg-muted text-muted-foreground",
} as const;

function PCP() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Factory className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PCP e Produção</h1>
          <p className="text-sm text-muted-foreground">Ordens ativas e capacidade das facções</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "OPs ativas", v: "47", i: Play, c: "text-info" },
          { l: "Concluídas (mês)", v: "128", i: CheckCircle2, c: "text-success" },
          { l: "Em atraso", v: "6", i: AlertTriangle, c: "text-destructive" },
          { l: "Aguardando", v: "12", i: Pause, c: "text-warning" },
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

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-1">Capacidade por facção</div>
        <div className="text-xs text-muted-foreground mb-4">% de utilização da semana</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={capacidade} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" horizontal={false} />
            <XAxis type="number" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="f" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} width={130} />
            <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="usado" fill="oklch(0.72 0.18 295)" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border text-sm font-semibold">Ordens de produção</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">OP</th>
              <th className="text-left font-medium px-5 py-2.5">Produto</th>
              <th className="text-right font-medium px-5 py-2.5">Qtd</th>
              <th className="text-left font-medium px-5 py-2.5">Facção</th>
              <th className="text-left font-medium px-5 py-2.5">Progresso</th>
              <th className="text-left font-medium px-5 py-2.5">Prazo</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordens.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-medium tabular-nums">{o.id}</td>
                <td className="px-5 py-3">{o.produto}</td>
                <td className="px-5 py-3 text-right tabular-nums">{o.qtd}</td>
                <td className="px-5 py-3 text-muted-foreground">{o.faccao}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${o.prog}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{o.prog}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{o.prazo}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${statusStyle[o.status]}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
