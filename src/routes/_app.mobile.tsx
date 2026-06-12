import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/mobile")({
  head: () => ({
    meta: [
      { title: "Aplicativo Mobile · USE MODA OS" },
      { name: "description", content: "App nativo para campo, fábrica e vendedores." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Aplicativo Mobile"
      description="App nativo para campo, fábrica e vendedores."
      icon={Smartphone}
      features={["App vendedor B2B","App apontamento fábrica","App estoque","Modo offline","Sincronização em background","Notificações push","Leitura de QR","Assinatura digital","Geolocalização"]}
    />
  ),
});
