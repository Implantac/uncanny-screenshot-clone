import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Pin } from "lucide-react";
import {
  getRecentProducts,
  getPinnedProducts,
  type RecentProduct,
  type PinnedProduct,
} from "@/lib/recent-products";

export function RecentProductsStrip() {
  const [recent, setRecent] = useState<RecentProduct[]>([]);
  const [pinned, setPinned] = useState<PinnedProduct[]>([]);

  useEffect(() => {
    const refresh = () => {
      setRecent(getRecentProducts());
      setPinned(getPinnedProducts());
    };
    refresh();
    window.addEventListener("plm:pinned-changed", refresh);
    return () => window.removeEventListener("plm:pinned-changed", refresh);
  }, []);

  if (!recent.length && !pinned.length) return null;

  const pinnedIds = new Set(pinned.map((p) => p.id));
  const recentOnly = recent.filter((r) => !pinnedIds.has(r.id));

  return (
    <div className="space-y-3">
      {pinned.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Pin className="size-3.5" />
            Fixados
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pinned.map((p) => (
              <Link
                key={p.id}
                to="/produto/$id"
                params={{ id: p.id }}
                className="shrink-0 min-w-[180px] max-w-[220px] rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors px-3 py-2"
              >
                <div className="text-[10px] font-mono text-muted-foreground truncate">{p.sku}</div>
                <div className="text-sm font-medium truncate">{p.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentOnly.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Clock className="size-3.5" />
            Continuar de onde parou
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentOnly.map((p) => (
              <Link
                key={p.id}
                to="/produto/$id"
                params={{ id: p.id }}
                className="shrink-0 min-w-[180px] max-w-[220px] rounded-md border border-border bg-background hover:bg-muted/40 transition-colors px-3 py-2"
              >
                <div className="text-[10px] font-mono text-muted-foreground truncate">{p.sku}</div>
                <div className="text-sm font-medium truncate">{p.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
