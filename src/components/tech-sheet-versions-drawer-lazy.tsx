import { lazy, Suspense } from "react";

const Inner = lazy(() =>
  import("./tech-sheet-versions-drawer").then((m) => ({ default: m.TechSheetVersionsDrawer })),
);

type Props = { techSheetId: string; open: boolean; onOpenChange: (o: boolean) => void };

export function TechSheetVersionsDrawer(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
