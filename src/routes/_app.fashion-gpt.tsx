import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/fashion-gpt")({
  head: () => ({
    meta: [
      { title: "Fashion GPT · USE MODA OS" },
      { name: "description", content: "Assistente especialista no seu negócio de moda." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Fashion GPT"
      description="Assistente especialista no seu negócio de moda."
      icon={Bot}
      features={["Pergunte em linguagem natural","Acessa todos os módulos","Sugestões de coleção","Análise de tendências","Resumos executivos","Geração de ficha técnica","Briefings automáticos","Tradução multi-idioma","Memória do negócio"]}
    />
  ),
});
