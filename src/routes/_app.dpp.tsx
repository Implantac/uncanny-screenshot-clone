import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/dpp")({
  head: () => ({
    meta: [
      { title: "Digital Product Passport · USE MODA OS" },
      { name: "description", content: "Passaporte digital e compliance ESG." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Digital Product Passport"
      description="Passaporte digital e compliance ESG."
      icon={ShieldCheck}
      features={["QR code por peça","Rastreabilidade total","Pegada de carbono","Composição certificada","Cadeia de fornecedores","Conformidade EU DPP","Reciclabilidade","Histórico de manutenção","Anti-falsificação"]}
    />
  ),
});
