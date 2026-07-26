import { lazy, Suspense } from "react";

const Inner = lazy(() =>
  import("./lote-references-drawer").then((m) => ({ default: m.LoteReferencesDrawer })),
);

type Props = React.ComponentProps<typeof Inner>;

export function LoteReferencesDrawer(props: Props) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
