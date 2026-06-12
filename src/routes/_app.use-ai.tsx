import { createFileRoute } from "@tanstack/react-router";
import { Cpu } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/use-ai")({
  head: () => ({
    meta: [
      { title: "USE AI · USE MODA OS" },
      { name: "description", content: "Agentes de IA para automação de processos." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="USE AI"
      description="Agentes de IA para automação de processos."
      icon={Cpu}
      features={["Agente comprador","Agente PCP","Agente de cobrança","Agente comercial","Workflows visuais","Triggers por evento","Conectores prontos","Logs auditáveis","Custo por execução"]}
    />
  ),
});
