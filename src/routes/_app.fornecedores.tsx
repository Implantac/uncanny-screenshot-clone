import { createFileRoute } from "@tanstack/react-router";
import { Truck, Star, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores · USE MODA OS" },
      { name: "description", content: "Portal de fornecedores e facções." },
    ],
  }),
  component: Fornecedores,
});

const fornecedores = [
  { nome: "Tecidos Paulista",    tipo: "Tecidos",    rating: 4.9, sla: 98, pedidos: 142, status: "Homologado",  ultimo: "12/06" },
  { nome: "Santos & Cia",        tipo: "Facção",     rating: 4.2, sla: 88, pedidos: 86,  status: "Homologado",  ultimo: "11/06" },
  { nome: "Forros & Cia",        tipo: "Tecidos",    rating: 4.7, sla: 95, pedidos: 64,  status: "Homologado",  ultimo: "10/06" },
  { nome: "Aviamentos Brasil",   tipo: "Aviamentos", rating: 4.5, sla: 92, pedidos: 218, status: "Homologado",  ultimo: "10/06" },
  { nome: "Confecção Lopes",     tipo: "Facção",     rating: 4.8, sla: 97, pedidos: 102, status: "Homologado",  ultimo: "09/06" },
  { nome: "Costura RS",          tipo: "Facção",     rating: 3.8, sla: 76, pedidos: 38,  status: "Em avaliação", ultimo: "08/06" },
  { nome: "Etiquetas SP",        tipo: "Aviamentos", rating: 4.6, sla: 94, pedidos: 320, status: "Homologado",  ultimo: "07/06" },
  { nome: "Tecidos Brasil",      tipo: "Tecidos",    rating: 3.4, sla: 68, pedidos: 28,  status: "Em alerta",   ultimo: "05/06" },
];

const statusStyle: Record<string, string> = {
  "Homologado":   "bg-success/15 text-success",
  "Em avaliação": "bg-warning/15 text-warning",
  "Em alerta":    "bg-destructive/15 text-destructive",
};

function Fornecedores() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Truck className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Portal de parceiros, facções e cadeia de suprimentos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Parceiros ativos", v: "84", i: Truck },
          { l: "SLA médio", v: "92%", i: CheckCircle2 },
          { l: "Rating médio", v: "4.6", i: Star },
          { l: "Cotações abertas", v: "12", i: Clock },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {fornecedores.map((f) => (
          <div key={f.nome} className="glass rounded-xl p-5 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="size-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 grid place-items-center text-sm font-semibold text-primary">
                {f.nome.split(" ").map(s=>s[0]).slice(0,2).join("")}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] ${statusStyle[f.status]}`}>{f.status}</span>
            </div>
            <div className="mt-3 font-medium">{f.nome}</div>
            <div className="text-xs text-muted-foreground">{f.tipo}</div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="inline-flex items-center gap-1"><Star className="size-3.5 text-warning fill-warning" /> <span className="tabular-nums">{f.rating}</span></div>
              <div className="text-muted-foreground tabular-nums">SLA {f.sla}%</div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground tabular-nums">{f.pedidos} pedidos · últ. {f.ultimo}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
