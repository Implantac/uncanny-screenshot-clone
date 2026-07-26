import { lazy, Suspense } from "react";

const Real = lazy(() =>
  import("./production-tech-sheet-drawer").then((m) => ({
    default: m.ProductionTechSheetDrawer,
  })),
);

type Props = {
  productId: string | null;
  productionOrderId?: string | null;
  orderCode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductionTechSheetDrawer(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Real {...props} />
    </Suspense>
  );
}
