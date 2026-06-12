import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Calendar, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing · USE MODA OS" },
      { name: "description", content: "Campanhas e performance de mídia." },
    ],
  }),
  component: Marketing,
});

const campanhas = [
  { nome: "Lançamento Verão 26", canal: "Meta + Google", inicio: "01/06", fim: "30/06", investimento: 84000, roas: 4.2, status: "Ativa" },
  { nome: "Drop Cápsula Praia",  canal: "Influencers",   inicio: "10/06", fim: "20/06", investimento: 32000, roas: 6.1, status: "Ativa" },
  { nome: "Resort 26 Teaser",    canal: "TikTok",        inicio: "05/06", fim: "15/06", investimento: 18000, roas: 3.4, status: "Ativa" },
  { nome: "Black Outono",        canal: "Email + Push",  inicio: "20/05", fim: "27/05", investimento: 8000,  roas: 8.2, status: "Concluída" },
  { nome: "Pre-Fall Hype",       canal: "Instagram",     inicio: "01/07", fim: "20/07", investimento: 24000, roas: 0,   status: "Programada" },
];

const perfMidia = [
  { c: "Meta",      v: 142 },
  { c: "Google",    v: 98 },
  { c: "TikTok",    v: 86 },
  { c: "Influencer", v: 124 },
  { c: "Email",     v: 64 },
];

const statusStyle: Record<string, string> = {
  "Ativa":      "bg-success/15 text-success",
  "Concluída":  "bg-muted text-muted-foreground",
  "Programada": "bg-info/15 text-info",
};

function Marketing() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Megaphone className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">Calendário editorial e performance de campanhas</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Investimento (mês)", v: "R$ 166k", d: "+12%" },
          { l: "ROAS médio", v: "4.8x", d: "+0.6x" },
          { l: "Campanhas ativas", v: "8", d: "+2" },
          { l: "Alcance", v: "1.4M", d: "+340k" },
        ].map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
            <div className="text-xs text-success mt-0.5 inline-flex items-center gap-0.5"><TrendingUp className="size-3" />{k.d}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-1">Performance por canal</div>
        <div className="text-xs text-muted-foreground mb-4">Conversões últimos 30d</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={perfMidia}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
            <XAxis dataKey="c" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border text-sm font-semibold inline-flex items-center gap-2"><Calendar className="size-4" /> Campanhas</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">Campanha</th>
              <th className="text-left font-medium px-5 py-2.5">Canal</th>
              <th className="text-left font-medium px-5 py-2.5">Período</th>
              <th className="text-right font-medium px-5 py-2.5">Investimento</th>
              <th className="text-right font-medium px-5 py-2.5">ROAS</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.map((c) => (
              <tr key={c.nome} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{c.nome}</td>
                <td className="px-5 py-3 text-muted-foreground">{c.canal}</td>
                <td className="px-5 py-3 text-muted-foreground tabular-nums">{c.inicio} → {c.fim}</td>
                <td className="px-5 py-3 text-right tabular-nums">R$ {c.investimento.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">{c.roas > 0 ? `${c.roas}x` : "—"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${statusStyle[c.status]}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
