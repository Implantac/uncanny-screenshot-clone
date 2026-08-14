import { lazy, Suspense } from "react";

const Real = lazy(() => import("./ask-fashion-ai").then((m) => ({ default: m.AskFashionAI })));
export function AskFashionAI() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" />}>
      <Real />
    </Suspense>
  );
}
