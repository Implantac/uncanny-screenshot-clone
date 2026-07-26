import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./marketing-brief-studio").then((m) => ({ default: m.MarketingBriefStudio })),
);
export function MarketingBriefStudio() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real />
    </Suspense>
  );
}
