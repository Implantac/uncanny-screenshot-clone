import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  /** ID do material na material_library */
  materialId: string;
  /** Custo unitário registrado no BOM da ficha técnica */
  bomUnitCost: number | null;
  /** Se true, mostra apenas o ícone (compacto) */
  compact?: boolean;
};

/**
 * MaterialCostDivergenceBadge — Badge que compara o custo do material
 * no BOM da ficha técnica vs o custo de referência na Biblioteca Global.
 * Acende alerta se a diferença for > 5%.
 */
export function MaterialCostDivergenceBadge({ materialId, bomUnitCost, compact }: Props) {
  const { data: refCost, isLoading } = useQuery({
    enabled: !!materialId,
    queryKey: ["material-ref-cost", materialId],
    queryFn: async () => {
      const { data } = await supabase
        .from("material_library")
        .select("reference_cost")
        .eq("id", materialId)
        .single();
      return Number(data?.reference_cost ?? 0);
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
  }

  if (!refCost || refCost <= 0 || bomUnitCost == null) return null;

  const divergence = Math.abs((bomUnitCost - refCost) / refCost);
  const isDivergent = divergence > 0.05;

  if (!isDivergent) {
    if (compact) return <CheckCircle2 className="size-3 text-emerald-500" />;
    return (
      <Badge
        variant="outline"
        className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-0.5 px-1.5 py-0"
      >
        <CheckCircle2 className="size-2.5" />
        Sinc.
      </Badge>
    );
  }

  const pct = ((bomUnitCost - refCost) / refCost) * 100;
  const isHigher = pct > 0;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isHigher ? "text-amber-600" : "text-blue-500"}`}
        title={`${isHigher ? "+" : ""}${pct.toFixed(1)}% vs biblioteca`}
      >
        {isHigher ? "▲" : "▼"}
        {Math.abs(pct).toFixed(0)}%
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`text-[9px] gap-0.5 px-1.5 py-0 ${
        isHigher
          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
          : "bg-blue-500/10 text-blue-600 border-blue-500/30"
      }`}
      title={`Custo BOM: R$ ${bomUnitCost.toFixed(2)} · Ref. biblioteca: R$ ${refCost.toFixed(2)}`}
    >
      <AlertTriangle className="size-2.5" />
      {isHigher ? "+" : ""}
      {pct.toFixed(0)}%
    </Badge>
  );
}
