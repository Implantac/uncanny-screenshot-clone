import { lazy, Suspense } from "react";

const Inner = lazy(() =>
  import("./product-duplicate-dialog").then((m) => ({ default: m.ProductDuplicateDialog })),
);

type Props = React.ComponentProps<typeof Inner>;

export function ProductDuplicateDialog(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
