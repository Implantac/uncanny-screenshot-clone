import { lazy, Suspense } from "react";

const Real = lazy(() => import("./assortment-panel").then((m) => ({ default: m.AssortmentPanel })));
export function AssortmentPanel(props: { collectionId: string; collectionName: string }) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real {...props} />
    </Suspense>
  );
}
