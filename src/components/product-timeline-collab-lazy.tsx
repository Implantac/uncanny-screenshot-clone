import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./product-timeline-collab").then((m) => ({ default: m.ProductTimelineCollab })),
);
export function ProductTimelineCollab(props: { productId: string }) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real {...props} />
    </Suspense>
  );
}
