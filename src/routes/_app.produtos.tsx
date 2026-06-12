import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({
    meta: [
      { title: "Desenvolvimento de Produtos · USE MODA OS" },
      { name: "description", content: "Pipeline kanban do briefing à aprovação do estilo." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Desenvolvimento de Produtos"
      description="Pipeline kanban do briefing à aprovação do estilo."
      icon={Sparkles}
      features={["Kanban de desenvolvimento","Brief de estilo","Galeria de croquis","Comentários em contexto","Aprovação multi-nível","Histórico completo","Integração CAD","Score de viabilidade","Custo estimado em tempo real"]}
    />
  ),
});
