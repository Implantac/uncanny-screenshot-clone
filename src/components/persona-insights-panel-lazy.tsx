import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const PersonaInsightsPanel = lazy(() =>
  import("./persona-insights-panel").then((m) => ({ default: m.PersonaInsightsPanel })),
);

type Props = React.ComponentProps<typeof PersonaInsightsPanel>;

export function PersonaInsightsPanelLazy(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
      <PersonaInsightsPanel {...props} />
    </Suspense>
  );
}
