import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { DevelopmentFlowDiagram } from "@/components/development-flow-diagram";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/fluxo-desenvolvimento")({
  head: () => ({
    meta: [
      { title: "Fluxo de Desenvolvimento — USE MODA PLM" },
      {
        name: "description",
        content:
          "Fluxograma do processo de desenvolvimento de novos produtos: concepção, reuniões de avaliação, ficha técnica, piloto, aprovações e liberação para PCP.",
      },
      { property: "og:title", content: "Fluxo de Desenvolvimento — USE MODA PLM" },
      {
        property: "og:description",
        content:
          "Do desenho ao PCP: veja em qual etapa está cada produto, os gates de aprovação e as reuniões oficiais.",
      },
    ],
  }),
  component: DevelopmentFlowPage,
});

function DevelopmentFlowPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Fluxo de Desenvolvimento"
        subtitle="Do desenho ao PCP · reuniões, gates e etapas oficiais do PLM"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/produto-kanban">
                <LayoutGrid className="size-4 mr-1.5" />
                Kanban por etapa
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/workflow">
                <Inbox className="size-4 mr-1.5" />
                Meu inbox
              </Link>
            </Button>
          </div>
        }
      />
      <DevelopmentFlowDiagram />
    </div>
  );
}
