import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const TrendRadarPanel = lazy(() =>
  import("./trend-radar-panel").then((m) => ({ default: m.TrendRadarPanel })),
);

type Props = React.ComponentProps<typeof TrendRadarPanel>;

export function TrendRadarPanelLazy(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
      <TrendRadarPanel {...props} />
    </Suspense>
  );
}
