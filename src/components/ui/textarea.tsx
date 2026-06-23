import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[72px] w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 hover:border-input/80 focus-visible:outline-none focus-visible:border-ring/60 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
