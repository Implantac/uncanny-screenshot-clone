import { createFileRoute } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/prototipos")({
  head: () => ({
    meta: [
      { title: "Protótipos · USE MODA OS" },
      { name: "description", content: "Ciclo completo de protótipos, provas e ajustes." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Protótipos"
      description="Ciclo completo de protótipos, provas e ajustes."
      icon={Scissors}
      features={["Solicitação de protótipo","Checklist de prova","Anotações em foto","Comparativo de medidas","Aprovação por amostra","Custo do protótipo","SLA por etapa","Histórico de ajustes","Integração com facções"]}
    />
  ),
});
