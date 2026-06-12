import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/almoxarifado")({
  head: () => ({
    meta: [
      { title: "Almoxarifado · USE MODA OS" },
      { name: "description", content: "Controle total de tecidos, aviamentos e produtos acabados." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Almoxarifado"
      description="Controle total de tecidos, aviamentos e produtos acabados."
      icon={Boxes}
      features={["Multi-depósito","Saldos em tempo real","Reserva por OP","Inventário rotativo","Endereçamento","Código de barras / QR","Curva ABC","Lotes e validade","Movimentações auditáveis"]}
    />
  ),
});
