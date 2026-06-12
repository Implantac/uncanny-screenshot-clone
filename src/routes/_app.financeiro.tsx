import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · USE MODA OS" },
      { name: "description", content: "Contas a pagar, receber, fluxo de caixa e DRE." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Financeiro"
      description="Contas a pagar, receber, fluxo de caixa e DRE."
      icon={Wallet}
      features={["Contas a pagar","Contas a receber","Fluxo de caixa","DRE gerencial","Conciliação bancária","Centros de custo","Boletos e Pix","Notas fiscais","Previsto vs realizado"]}
    />
  ),
});
