import { createFileRoute } from "@tanstack/react-router";
import { PenTool } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/cad")({
  head: () => ({
    meta: [
      { title: "CAD e Modelagem · USE MODA OS" },
      { name: "description", content: "Integração com CADs líderes e biblioteca de moldes." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="CAD e Modelagem"
      description="Integração com CADs líderes e biblioteca de moldes."
      icon={PenTool}
      features={["Biblioteca de moldes","Encaixe automático","Graduação","Importação Audaces/Optitex","Render 3D","Histórico de revisões","Controle de consumo","Compartilhamento com facções","Plotagem digital"]}
    />
  ),
});
