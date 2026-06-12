import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/colecoes")({
  head: () => ({
    meta: [
      { title: "Gestão de Coleções · USE MODA OS" },
      { name: "description", content: "Planeje coleções, linhas e calendário sazonal com timeline visual." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Gestão de Coleções"
      description="Planeje coleções, linhas e calendário sazonal com timeline visual."
      icon={Layers}
      features={["Calendário sazonal","Linhas e temas","Briefing colaborativo","Aprovações por etapa","Galeria de referências","Versionamento","Comparativo de temporadas","Custo-alvo por linha","Cronograma crítico"]}
    />
  ),
});
