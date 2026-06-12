import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores · USE MODA OS" },
      { name: "description", content: "Portal completo para fornecedores e facções." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Fornecedores"
      description="Portal completo para fornecedores e facções."
      icon={Truck}
      features={["Portal do fornecedor","Cotações online","Pedidos de compra","Aprovação de NF","SLA e rating","Documentos e contratos","Cadastro homologado","Avaliação ESG","Histórico financeiro"]}
    />
  ),
});
