import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";

const Inner = lazy(() =>
  import("./collection-compare-dialog").then((m) => ({ default: m.CollectionCompareDialog })),
);

// Match the original component's props loosely to avoid a type dependency.
type AnyProps = { collections: any[] };

export function CollectionCompareDialog(props: AnyProps) {
  return (
    <Suspense fallback={<Button variant="outline" size="sm" disabled>Comparar</Button>}>
      <Inner {...props} />
    </Suspense>
  );
}
