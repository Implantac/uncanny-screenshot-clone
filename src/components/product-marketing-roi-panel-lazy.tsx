import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./product-marketing-roi-panel").then((m) => ({ default: m.ProductMarketingRoiPanel })),
);
export function ProductMarketingRoiPanel() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real />
    </Suspense>
  );
}
