import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Play, Pause, Plus, Activity } from "lucide-react";

export const Route = createFileRoute("/_app/use-ai")({
  head: () => ({
    meta: [
      { title: "USE AI · USE MODA OS" },
      { name: "description", content: "Agentes de IA para automação de processos de moda." },
    ],
  }),
  component: UseAI,
});

const agentes = [
  { nome: "Agente Comprador", desc: "Cota fornecedores e gera pedidos de compra automaticamente",   exec: 1842, status: "Ativo", taxa: "98%", ultima: "há 2 min" },
  { nome: "Agente PCP",        desc: "Sequencia ordens e balanceia capacidade entre facções",        exec: 624,  status: "Ativo", taxa: "95%", ultima: "há 8 min" },
  { nome: "Agente Cobrança",   desc: "Aciona clientes inadimplentes via WhatsApp e email",          exec: 312,  status: "Ativo", taxa: "87%", ultima: "há 14 min" },
  { nome: "Agente Comercial",  desc: "Sugere mix de produtos para cada cliente B2B",                exec: 218,  status: "Ativo", taxa: "92%", ultima: "há 22 min" },
  { nome: "Agente Estoque",    desc: "Alerta e sugere reposições de itens críticos",                exec: 1204, status: "Ativo", taxa: "99%", ultima: "há 4 min" },
  { nome: "Agente Tendências", desc: "Monitora redes e reporta tendências para o time de estilo",   exec: 84,   status: "Pausado", taxa: "—", ultima: "há 2 dias" },
];

function UseAI() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Cpu className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">USE AI</h1>
            <p className="text-sm text-muted-foreground">{agentes.filter(a=>a.status==="Ativo").length} agentes ativos · {agentes.reduce((s,a)=>s+a.exec,0).toLocaleString("pt-BR")} execuções no mês</p>
          </div>
        </div>
        <button className="h-9 px-4 rounded-md text-sm font-medium bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] inline-flex items-center gap-2">
          <Plus className="size-4" /> Novo agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agentes.map((a) => (
          <div key={a.nome} className="glass rounded-xl p-5 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${a.status==="Ativo"?"bg-success/15 text-success":"bg-muted text-muted-foreground"}`}>
                  {a.status === "Ativo" ? <Activity className="size-5" /> : <Pause className="size-5" />}
                </div>
                <div>
                  <div className="font-medium">{a.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</div>
                </div>
              </div>
              <button className="size-8 rounded-md bg-muted hover:bg-muted/70 grid place-items-center text-muted-foreground">
                {a.status === "Ativo" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground">Execuções</div>
                <div className="font-medium tabular-nums mt-0.5">{a.exec.toLocaleString("pt-BR")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Sucesso</div>
                <div className="font-medium tabular-nums mt-0.5">{a.taxa}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Última</div>
                <div className="font-medium mt-0.5">{a.ultima}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
