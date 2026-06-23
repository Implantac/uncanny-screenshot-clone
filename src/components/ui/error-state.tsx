import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar essas informações.",
  onRetry,
  retryLabel = "Tentar novamente",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-6 gap-3 rounded-xl border border-destructive/30 bg-destructive/5",
        className,
      )}
      {...props}
    >
      <div className="grid place-items-center size-12 rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          <RefreshCw className="size-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
