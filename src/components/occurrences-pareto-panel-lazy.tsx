import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./occurrences-pareto-panel").then((m) => ({ default: m.OccurrencesParetoPanel })),
);
export function OccurrencesParetoPanel(props: { windowDays?: number }) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real {...props} />
    </Suspense>
  );
}
