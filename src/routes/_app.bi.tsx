import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/bi")({
  head: () => ({
    meta: [
      { title: "BI e Analytics · USE MODA OS" },
      { name: "description", content: "Dashboards customizáveis e exploração de dados." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="BI e Analytics"
      description="Dashboards customizáveis e exploração de dados."
      icon={BarChart3}
      features={["Dashboards drag-and-drop","Drill-down","+200 KPIs prontos","Alertas inteligentes","Comparativos","Compartilhamento","Exportação","Modelo semântico","Embed em telas"]}
    />
  ),
});
