import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type GateRow = { requirement: string; ok: boolean; detail: string | null };

const CRITICAL = new Set([
  "Ficha técnica aprovada",
  "BOM (materiais)",
  "Custo definido",
  "Protótipo aprovado",
]);

const EXPLAIN: Record<string, string> = {
  "Ficha técnica aprovada":
    "A ficha técnica precisa estar em versão aprovada — é o contrato do produto com a fábrica (tecido, medidas, aviamentos, sequência).",
  "BOM (materiais)":
    "A lista de materiais (BOM) precisa ter pelo menos 1 item com consumo definido — sem BOM não há MRP nem custo real.",
  "Custo definido":
    "O produto precisa de custo calculado (materiais + processo). Sem custo o comercial não precifica e o PCP não libera OP.",
  "Protótipo aprovado":
    "Ao menos uma peça piloto precisa estar aprovada — garante que o produto foi provado, medido e liberado antes de escalar.",
};

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
  const failing = critical.filter((r) => !r.ok);
  const ready = failing.length === 0;

  const summary = ready
    ? "Pronto para produção — todos os gates críticos passaram."
    : `${failing.length} de ${critical.length} gates críticos pendentes: ${failing
        .map((f) => f.requirement)
        .join(", ")}.`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-label={`Prontidão para produção: ${summary}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums cursor-help",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              ready
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
              className,
            )}
          >
            {ready ? (
              <ShieldCheck className="size-3" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-3" aria-hidden="true" />
            )}
            <span aria-hidden="true">
              {ready ? "Pronto" : `${failing.length}/${critical.length}`}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" role="tooltip" className="max-w-xs p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-muted/40">
            <div className="text-[11px] font-semibold">
              {ready ? "Pronto para produção" : "Gates críticos pendentes"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {ready
                ? "Todos os gates críticos passaram — o PCP pode abrir OP com segurança."
                : `${failing.length} de ${critical.length} gate(s) crítico(s) ainda travam a produção.`}
            </div>
          </div>
          <ul className="p-2 space-y-1.5">
            {critical.map((g) => (
              <li key={g.requirement} className="flex items-start gap-2">
                {g.ok ? (
                  <Check className="size-3 mt-0.5 text-emerald-500 shrink-0" aria-hidden="true" />
                ) : (
                  <X className="size-3 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />
                )}
                <span className="sr-only">{g.ok ? "Aprovado:" : "Pendente:"}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium leading-tight">{g.requirement}</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">
                    {g.detail ?? EXPLAIN[g.requirement] ?? ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
