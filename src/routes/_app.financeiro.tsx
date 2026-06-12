import { createFileRoute } from "@tanstack/react-router";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · USE MODA OS" },
      { name: "description", content: "Fluxo de caixa, DRE e contas." },
    ],
  }),
  component: Financeiro,
});

const fluxo = Array.from({ length: 12 }, (_, i) => ({
  m: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i],
  receita: 1.2 + i * 0.22 + Math.random()*0.3,
  despesa: 0.9 + i * 0.16 + Math.random()*0.2,
}));

const contas = [
  { tipo: "Pagar",    desc: "Tecidos Paulista — NF 8842",  venc: "18/06", valor: 48200, status: "Pendente" },
  { tipo: "Pagar",    desc: "Aluguel galpão Vila Olímpia",  venc: "10/06", valor: 32000, status: "Pago" },
  { tipo: "Receber",  desc: "Boutique Iguatemi — Ped #5821", venc: "20/06", valor: 92480, status: "Pendente" },
  { tipo: "Pagar",    desc: "Folha de pagamento Maio",       venc: "05/06", valor: 184000, status: "Pago" },
  { tipo: "Receber",  desc: "Loja Oscar Freire — Ped #5820", venc: "25/06", valor: 48200, status: "Pendente" },
  { tipo: "Pagar",    desc: "Energia + Água fábrica",       venc: "15/06", valor: 12800, status: "Pendente" },
];

function Financeiro() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Wallet className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Caixa, contas e DRE gerencial</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Saldo em caixa", v: "R$ 1.2M", d: "+8.4%", up: true },
          { l: "A receber (30d)", v: "R$ 842k", d: "+12.1%", up: true },
          { l: "A pagar (30d)", v: "R$ 614k", d: "+3.2%", up: false },
          { l: "Margem líquida", v: "22.4%", d: "+1.8pp", up: true },
        ].map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
            <div className={`text-xs mt-0.5 inline-flex items-center gap-0.5 ${k.up ? "text-success" : "text-destructive"}`}>
              {k.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{k.d}
            </div>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-1">Fluxo de caixa</div>
        <div className="text-xs text-muted-foreground mb-4">Receita vs despesa (R$ milhões)</div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={fluxo}>
            <defs>
              <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.74 0.17 155)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.74 0.17 155)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="des" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.62 0.22 25)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.62 0.22 25)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
            <XAxis dataKey="m" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="receita" stroke="oklch(0.74 0.17 155)" strokeWidth={2} fill="url(#rec)" />
            <Area type="monotone" dataKey="despesa" stroke="oklch(0.62 0.22 25)" strokeWidth={2} fill="url(#des)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border text-sm font-semibold">Contas — próximos 30 dias</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left font-medium px-5 py-2.5">Tipo</th>
              <th className="text-left font-medium px-5 py-2.5">Descrição</th>
              <th className="text-left font-medium px-5 py-2.5">Vencimento</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
              <th className="text-right font-medium px-5 py-2.5">Valor</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${c.tipo==="Receber"?"bg-success/15 text-success":"bg-info/15 text-info"}`}>{c.tipo}</span>
                </td>
                <td className="px-5 py-3 font-medium">{c.desc}</td>
                <td className="px-5 py-3 text-muted-foreground">{c.venc}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${c.status==="Pago"?"bg-success/15 text-success":"bg-warning/15 text-warning"}`}>{c.status}</span></td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">R$ {c.valor.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
