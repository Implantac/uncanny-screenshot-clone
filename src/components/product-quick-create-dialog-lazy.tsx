import { lazy, Suspense } from "react";

const Inner = lazy(() =>
  import("./product-quick-create-dialog").then((m) => ({ default: m.ProductQuickCreateDialog })),
);

type Props = React.ComponentProps<typeof Inner>;

export function ProductQuickCreateDialog(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
