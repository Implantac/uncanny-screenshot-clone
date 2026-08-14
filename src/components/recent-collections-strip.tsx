import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Star } from "lucide-react";
import {
  getRecentCollections,
  getPinnedCollections,
  type RecentCollection,
  type PinnedCollection,
} from "@/lib/recent-collections";

export function RecentCollectionsStrip() {
  const [recent, setRecent] = useState<RecentCollection[]>([]);
  const [pinned, setPinned] = useState<PinnedCollection[]>([]);

  useEffect(() => {
    const refresh = () => {
      setRecent(getRecentCollections());
      setPinned(getPinnedCollections());
    };
    refresh();
    window.addEventListener("plm:pinned-collections-changed", refresh);
    return () => window.removeEventListener("plm:pinned-collections-changed", refresh);
  }, []);

  if (!recent.length && !pinned.length) return null;

  const pinnedIds = new Set(pinned.map((p) => p.id));
  const recentOnly = recent.filter((r) => !pinnedIds.has(r.id));

  const subtitle = (c: RecentCollection) => [c.season, c.year].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3">
      {pinned.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Star className="size-3.5" />
            Coleções fixadas
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pinned.map((c) => (
              <Link
                key={c.id}
                to="/colecao-360/$id"
                params={{ id: c.id }}
                className="shrink-0 min-w-[180px] max-w-[220px] rounded-md border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors px-3 py-2"
              >
                <div className="text-[10px] text-muted-foreground truncate">
                  {subtitle(c) || "Coleção"}
                </div>
                <div className="text-sm font-medium truncate">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentOnly.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Clock className="size-3.5" />
            Coleções recentes
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentOnly.map((c) => (
              <Link
                key={c.id}
                to="/colecao-360/$id"
                params={{ id: c.id }}
                className="shrink-0 min-w-[180px] max-w-[220px] rounded-md border border-border bg-background hover:bg-muted/40 transition-colors px-3 py-2"
              >
                <div className="text-[10px] text-muted-foreground truncate">
                  {subtitle(c) || "Coleção"}
                </div>
                <div className="text-sm font-medium truncate">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
