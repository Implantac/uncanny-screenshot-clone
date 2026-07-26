import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const Inner = lazy(() =>
  import("./material-sourcing-risk-panel").then((m) => ({ default: m.MaterialSourcingRiskPanel })),
);

export function MaterialSourcingRiskPanel() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Inner />
    </Suspense>
  );
}
