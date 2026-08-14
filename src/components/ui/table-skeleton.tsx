import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable skeleton for data tables/lists.
 * Use while Supabase queries are loading (never on top of already-cached data).
 */
export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-full" : "w-2/3")} />
          ))}
        </div>
      ))}
    </div>
  );
}
