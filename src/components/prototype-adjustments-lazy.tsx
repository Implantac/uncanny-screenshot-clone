import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";

const Inner = lazy(() =>
  import("./prototype-adjustments").then((m) => ({ default: m.PrototypeAdjustmentsButton })),
);

type Props = React.ComponentProps<typeof Inner>;

export { SECTORS } from "./prototype-adjustments";
export type { AdjustmentSector } from "./prototype-adjustments";

export function PrototypeAdjustmentsButton(props: Props) {
  return (
    <Suspense fallback={<Button variant="outline" size="sm" disabled>Ajustes</Button>}>
      <Inner {...props} />
    </Suspense>
  );
}
