import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type GateRow = { requirement: string; ok: boolean; detail: string | null };

const CRITICAL = new Set([
  "Ficha técnica aprovada",
  "BOM (materiais)",
  "Custo definido",
  "Protótipo aprovado",
]);

/**
 * Compact production-readiness pill for list/grid contexts.
 * Shares the `product-gate-status` cache key with StageGatePanel/ReadinessCard
 * so opening the product workspace reuses the same query.
 */
export function ProductReadinessBadge({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ["product-gate-status", productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("product_gate_status", {
        _product_id: productId,
      });
      if (error) throw error;
      return (data ?? []) as GateRow[];
    },
    staleTime: 60_000,
  });

  if (q.isLoading || !q.data) return null;
  const critical = q.data.filter((r) => CRITICAL.has(r.requirement));
  if (critical.length === 0) return null;
  const failing = critical.filter((r) => !r.ok).length;
  const ready = failing === 0;

  const title = ready
    ? "Pronto para produção — todos os gates críticos passaram"
    : `${failing} gate(s) crítico(s) pendente(s): ${critical
        .filter((r) => !r.ok)
        .map((r) => r.requirement)
        .join(", ")}`;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        ready
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {ready ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
      {ready ? "Pronto" : `${failing}/${critical.length}`}
    </span>
  );
}
