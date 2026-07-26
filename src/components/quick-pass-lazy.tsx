import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";

const Inner = lazy(() =>
  import("./quick-pass").then((m) => ({ default: m.QuickPassButton })),
);

type Props = React.ComponentProps<typeof Inner>;

export function QuickPassButton(props: Props) {
  return (
    <Suspense fallback={<Button variant="outline" size="sm" disabled>Passar</Button>}>
      <Inner {...props} />
    </Suspense>
  );
}
