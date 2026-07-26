import { lazy, Suspense } from "react";
import type { MrpRow } from "@/lib/mrp-planning.functions";

const Real = lazy(() =>
  import("./mrp-material-drawer").then((m) => ({ default: m.MrpMaterialDrawer })),
);

export function MrpMaterialDrawer({
  row,
  onClose,
}: {
  row: MrpRow | null;
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <Suspense fallback={null}>
      <Real row={row} onClose={onClose} />
    </Suspense>
  );
}
