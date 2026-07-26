import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const Inner = lazy(() =>
  import("./inventory-scraps-panel").then((m) => ({ default: m.InventoryScrapsPanel })),
);

export function InventoryScrapsPanel() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Inner />
    </Suspense>
  );
}
