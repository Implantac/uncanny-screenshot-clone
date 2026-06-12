import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/ficha-tecnica")({
  head: () => ({
    meta: [
      { title: "Ficha Técnica Inteligente · USE MODA OS" },
      { name: "description", content: "Tech packs gerados e versionados com IA." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Ficha Técnica Inteligente"
      description="Tech packs gerados e versionados com IA."
      icon={FileText}
      features={["Geração com IA","Versionamento","Lista de materiais","Tabela de medidas","Construção e acabamento","Etiquetas e composição","Exportação PDF/Excel","Comparação entre versões","Aprovação digital"]}
    />
  ),
});
