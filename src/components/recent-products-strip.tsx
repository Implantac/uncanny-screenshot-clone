import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { getRecentProducts, type RecentProduct } from "@/lib/recent-products";

export function RecentProductsStrip() {
  const [items, setItems] = useState<RecentProduct[]>([]);
  useEffect(() => {
    setItems(getRecentProducts());
  }, []);
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Clock className="size-3.5" />
        Continuar de onde parou
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((p) => (
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
  );
}
