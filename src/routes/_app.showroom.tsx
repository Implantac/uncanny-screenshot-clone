import { createFileRoute } from "@tanstack/react-router";
import { MonitorPlay } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/showroom")({
  head: () => ({
    meta: [
      { title: "Showroom Digital · USE MODA OS" },
      { name: "description", content: "Showroom virtual com lookbooks interativos." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Showroom Digital"
      description="Showroom virtual com lookbooks interativos."
      icon={MonitorPlay}
      features={["Lookbook 3D","Ambientes virtuais","Provador AR","Apresentação ao vivo","Pedidos no showroom","Compartilhamento por link","Métricas de engajamento","Multi-idioma","Modo apresentação"]}
    />
  ),
});
