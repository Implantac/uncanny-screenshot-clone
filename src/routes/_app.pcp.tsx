import { createFileRoute } from "@tanstack/react-router";
import { Factory } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/pcp")({
  head: () => ({
    meta: [
      { title: "PCP e Produção · USE MODA OS" },
      { name: "description", content: "Planejamento, ordens de produção e apontamento em tempo real." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="PCP e Produção"
      description="Planejamento, ordens de produção e apontamento em tempo real."
      icon={Factory}
      features={["Plano mestre","Ordens de produção","Apontamento mobile","Capacidade por facção","Sequenciamento","Gráfico de Gantt","Eficiência (OEE)","Alertas de atraso","Roteiro de fabricação"]}
    />
  ),
});
