import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./supplier-360-drawer").then((m) => ({ default: m.Supplier360Drawer })),
);

type Props = {
  supplierId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function Supplier360Drawer(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Real {...props} />
    </Suspense>
  );
}
