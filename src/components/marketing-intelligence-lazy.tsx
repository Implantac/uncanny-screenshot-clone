import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./marketing-intelligence").then((m) => ({ default: m.MarketingIntelligence })),
);
export function MarketingIntelligence() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real />
    </Suspense>
  );
}
