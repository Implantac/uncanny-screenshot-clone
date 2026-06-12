import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/comercial")({
  head: () => ({
    meta: [
      { title: "Comercial / B2B · USE MODA OS" },
      { name: "description", content: "Portal B2B, pedidos, representantes e clientes." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Comercial / B2B"
      description="Portal B2B, pedidos, representantes e clientes."
      icon={Store}
      features={["Portal B2B","Catálogo digital","Tabelas de preço","Carteira de pedidos","Representantes","CRM integrado","Comissionamento","Crédito por cliente","Mix sugerido com IA"]}
    />
  ),
});
