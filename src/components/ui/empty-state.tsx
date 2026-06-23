import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nada por aqui ainda",
  description,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-14 px-6 gap-3",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "grid place-items-center rounded-full bg-muted/50 text-muted-foreground ring-1 ring-border/60",
          compact ? "size-10" : "size-14",
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} />
      </div>
      <div className="space-y-1">
        <h3 className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
