import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  getTechSheetBomReviews,
  acknowledgeTechSheetBomReview,
} from "@/lib/tech-sheet-bom-review.functions";
import { toast } from "sonner";

export function TechSheetBomReviewPanel() {
  const list = useServerFn(getTechSheetBomReviews);
  const ack = useServerFn(acknowledgeTechSheetBomReview);
  const qc = useQueryClient();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["tech-sheet-bom-reviews"],
    queryFn: () => list(),
    refetchInterval: 60_000,
  });

  const ackMutation = useMutation({
    mutationFn: (techSheetId: string) => ack({ data: { techSheetId } }),
    onSuccess: () => {
      toast.success("Revisão de BOM confirmada");
      qc.invalidateQueries({ queryKey: ["tech-sheet-bom-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Card className="p-4 h-24 animate-pulse bg-muted/30" />;

  if (flags.length === 0) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <ShieldCheck className="size-5 text-emerald-400" />
        <div className="text-sm">
          <div className="font-medium">BOM em dia</div>
          <div className="text-muted-foreground text-xs">
            Nenhuma ficha técnica pendente de revisão por troca de fornecedor.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-widest">
            Revisão de BOM pendente
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {flags.length} ficha(s)
        </Badge>
      </div>
      <div className="grid gap-2">
        {flags.slice(0, 12).map((f) => (
          <div
            key={f.techSheetId}
            className="flex items-start gap-3 rounded-md border bg-muted/30 p-2.5"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {f.productName ?? f.sku ?? f.code ?? f.techSheetId.slice(0, 8)}
                {f.version && (
                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                    v{f.version}
                  </span>
                )}
              </div>
              {f.reason && (
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {f.reason}
                </div>
              )}
              {f.flaggedAt && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(f.flaggedAt).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={ackMutation.isPending}
              onClick={() => ackMutation.mutate(f.techSheetId)}
            >
              <CheckCircle2 className="size-3.5" />
              Revisado
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
