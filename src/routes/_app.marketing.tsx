import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing · USE MODA OS" },
      { name: "description", content: "Calendário de campanhas e performance de mídia." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Marketing"
      description="Calendário de campanhas e performance de mídia."
      icon={Megaphone}
      features={["Calendário editorial","Briefing de campanhas","Banco de assets","Performance de mídia","Influencer tracking","UTM builder","Aprovações criativas","Relatórios automáticos","Integração Meta/Google"]}
    />
  ),
});
