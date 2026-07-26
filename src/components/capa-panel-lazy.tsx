import { lazy, Suspense } from "react";

const Real = lazy(() => import("./capa-panel").then((m) => ({ default: m.CapaPanel })));
export function CapaPanel() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real />
    </Suspense>
  );
}
