import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

const TechPackExportButton = lazy(() =>
  import("./tech-pack-export-button").then((m) => ({ default: m.TechPackExportButton })),
);

type Props = React.ComponentProps<typeof TechPackExportButton>;

export function TechPackExportButtonLazy(props: Props) {
  return (
    <Suspense
      fallback={
        <Button variant="outline" size="sm" disabled>
          <FileDown className="size-4 mr-1" /> Exportar
        </Button>
      }
    >
      <TechPackExportButton {...props} />
    </Suspense>
  );
}
