import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const ThemesInner = lazy(() =>
  import("./themes-lines-panel").then((m) => ({ default: m.ThemesPanel })),
);
const LinesInner = lazy(() =>
  import("./themes-lines-panel").then((m) => ({ default: m.LinesDialogButton })),
);

export function ThemesPanel(props: { collectionId: string; collectionName: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ThemesInner {...props} />
    </Suspense>
  );
}

export function LinesDialogButton() {
  return (
    <Suspense
      fallback={
        <Button variant="outline" size="sm" disabled>
          Linhas
        </Button>
      }
    >
      <LinesInner />
    </Suspense>
  );
}
