import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, Loader2 } from "lucide-react";
import { getSupplierDefectRanking, type SupplierDefectRow } from "@/lib/quality-rca.functions";
import { Badge } from "@/components/ui/badge";

export function SupplierDefectRcaPanel() {
  const fn = useServerFn(getSupplierDefectRanking);
  const q = useQuery({
    queryKey: ["supplier-defect-rca"],
    queryFn: () => fn() as Promise<SupplierDefectRow[]>,
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-4 pb-2 text-sm font-medium">
        <ShieldAlert className="size-4 text-destructive" />
        Reincidência por fornecedor (90 dias)
      </div>
      <div className="px-4 pb-4">
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="size-3.5 animate-spin" /> Cruzando inspeções…
          </div>
        ) : !q.data?.length ? (
          <div className="text-xs text-muted-foreground py-4">
            Sem fornecedores com inspeções suficientes (mín. 3 em 90 dias).
          </div>
        ) : (
          <ol className="space-y-1.5">
            {q.data.map((r, i) => (
              <li
                key={r.supplier_id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-2.5 text-sm"
              >
                <div className="grid size-7 place-items-center rounded-md bg-destructive/10 text-xs font-bold text-destructive shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{r.supplier_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.total_inspections} insp.
                    </Badge>
                    {r.critical > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"
                      >
                        {r.critical} crítico{r.critical > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        r.fpy < 80
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : r.fpy < 90
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            : ""
                      }`}
                    >
                      FPY {r.fpy}%
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.reason}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
