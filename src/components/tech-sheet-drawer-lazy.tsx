import { lazy, Suspense, useState } from "react";
import { FileText } from "lucide-react";

const InnerDrawer = lazy(() =>
  import("./tech-sheet-drawer").then((m) => ({ default: m.TechSheetDrawer })),
);

type TriggerProps = React.ComponentProps<typeof import("./tech-sheet-drawer").TechSheetDrawerTrigger>;

export function TechSheetDrawerTrigger(props: TriggerProps) {
  const [open, setOpen] = useState(false);
  const { className, label = "Ficha", ...rest } = props as any;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          "flex flex-col items-center gap-0.5 py-1.5 rounded-md hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground"
        }
        title="Abrir ficha técnica"
      >
        <FileText className="size-3.5" />
        <span>{label}</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <InnerDrawer {...rest} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
