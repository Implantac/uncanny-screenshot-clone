import { createFileRoute } from "@tanstack/react-router";
import { Store, Search, MoreHorizontal } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useState } from "react";

export const Route = createFileRoute("/_app/comercial")({
  head: () => ({
    meta: [
      { title: "Comercial / B2B · USE MODA OS" },
      { name: "description", content: "Portal B2B, pedidos e carteira de clientes." },
    ],
  }),
  component: Comercial,
});

const pedidos = [
  { id: "#5821", cliente: "Boutique Iguatemi", rep: "Ana P.",   valor: 92480, status: "Faturado", data: "12/06" },
  { id: "#5820", cliente: "Loja Oscar Freire", rep: "Carlos M.", valor: 48200, status: "Em produção", data: "12/06" },
  { id: "#5819", cliente: "Multimarcas RJ",    rep: "Ana P.",   valor: 31200, status: "Aprovado", data: "11/06" },
  { id: "#5818", cliente: "Concept Store BH",  rep: "Luiz T.",  valor: 28900, status: "Aprovado", data: "11/06" },
  { id: "#5817", cliente: "Boutique Recife",   rep: "Carlos M.", valor: 18700, status: "Pendente", data: "10/06" },
  { id: "#5816", cliente: "Loja Curitiba",     rep: "Luiz T.",  valor: 64500, status: "Faturado", data: "10/06" },
  { id: "#5815", cliente: "Showroom POA",      rep: "Ana P.",   valor: 12400, status: "Cancelado", data: "09/06" },
  { id: "#5814", cliente: "Multimarcas Floripa", rep: "Carlos M.", valor: 39800, status: "Em produção", data: "09/06" },
];

const statusStyle: Record<string, string> = {
  "Faturado":    "bg-success/15 text-success",
  "Em produção": "bg-info/15 text-info",
  "Aprovado":    "bg-primary/15 text-primary",
  "Pendente":    "bg-warning/15 text-warning",
  "Cancelado":   "bg-destructive/15 text-destructive",
};

const trend = Array.from({ length: 14 }, (_, i) => ({
  d: `${i+1}`, v: Math.round(40 + Math.random() * 80 + i * 3),
}));

function Comercial() {
  const [q, setQ] = useState("");
  const filtered = pedidos.filter((p) => p.cliente.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q));
  const total = pedidos.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Store className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comercial / B2B</h1>
          <p className="text-sm text-muted-foreground">Portal B2B, pedidos e carteira de clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Receita 30d",   v: `R$ ${(total/1000).toFixed(0)}k`, d: "+18.2%" },
          { l: "Pedidos abertos", v: "47", d: "+6" },
          { l: "Ticket médio",  v: "R$ 5.964", d: "+4.1%" },
          { l: "Clientes ativos", v: "382", d: "-2.1%" },
        ].map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
            <div className="text-xs text-success mt-0.5">{k.d}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Vendas — últimos 14 dias</div>
            <div className="text-xs text-muted-foreground">Receita diária (R$ mil)</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
            <XAxis dataKey="d" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="v" stroke="oklch(0.72 0.18 295)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">Pedidos recentes</div>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar cliente ou #pedido…"
              className="w-72 h-9 pl-8 pr-3 rounded-md bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">Pedido</th>
              <th className="text-left font-medium px-5 py-2.5">Cliente</th>
              <th className="text-left font-medium px-5 py-2.5">Representante</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
              <th className="text-left font-medium px-5 py-2.5">Data</th>
              <th className="text-right font-medium px-5 py-2.5">Valor</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 font-medium tabular-nums">{p.id}</td>
                <td className="px-5 py-3">{p.cliente}</td>
                <td className="px-5 py-3 text-muted-foreground">{p.rep}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${statusStyle[p.status]}`}>{p.status}</span></td>
                <td className="px-5 py-3 text-muted-foreground">{p.data}</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">R$ {p.valor.toLocaleString("pt-BR")}</td>
                <td className="px-3 py-3"><button className="size-7 rounded hover:bg-muted grid place-items-center text-muted-foreground"><MoreHorizontal className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
