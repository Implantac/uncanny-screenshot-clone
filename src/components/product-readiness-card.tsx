import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type GateRow = { requirement: string; ok: boolean; detail: string | null };

const CRITICAL = new Set([
  "Ficha técnica aprovada",
  "BOM (materiais)",
  "Custo definido",
  "Protótipo aprovado",
]);

const RESOLVE_HINT: Record<string, { label: string; anchor?: string }> = {
  "Ficha técnica aprovada": { label: "Abrir ficha", anchor: "ficha" },
  "BOM (materiais)": { label: "Abrir BOM", anchor: "bom" },
  "Custo definido": { label: "Ver custos", anchor: "custos" },
  "Protótipo aprovado": { label: "Ver protótipos", anchor: "prototipos" },
};

/**
 * Compact "Ready for production?" card. Shares the same cache key as
 * `StageGatePanel` so both stay in sync without extra fetches.
 */
export function ProductReadinessCard({ productId }: { productId: string }) {
  const q = useQuery({
    queryKey: ["product-gate-status", productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("product_gate_status", {
        _product_id: productId,
      });
      if (error) throw error;
      return (data ?? []) as GateRow[];
    },
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Avaliando gates de produção…
      </div>
    );
  }

  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  const critical = rows.filter((r) => CRITICAL.has(r.requirement));
  const failing = critical.filter((r) => !r.ok);
  const ready = failing.length === 0;
  const passed = critical.length - failing.length;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        ready
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck
          className={cn(
            "size-4",
            ready ? "text-emerald-600" : "text-amber-600",
          )}
        />
        <div className="text-sm font-semibold">
          {ready ? "Pronto para produção" : "Bloqueado para abrir OP"}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {passed}/{critical.length} gates críticos
        </span>
      </div>

      {ready ? (
        <div className="text-xs text-muted-foreground">
          Todos os gates críticos passaram. Este produto pode gerar OPs sem bypass.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {failing.map((r) => {
            const hint = RESOLVE_HINT[r.requirement];
            return (
              <li
                key={r.requirement}
                className="flex items-start gap-2 text-xs"
              >
                <XCircle className="size-3.5 text-rose-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{r.requirement}</div>
                  {r.detail && (
                    <div className="text-muted-foreground truncate">
                      {r.detail}
                    </div>
                  )}
                </div>
                {hint && (
                  <Link
                    to="/produto/$id"
                    params={{ id: productId }}
                    hash={hint.anchor}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
                  >
                    {hint.label}
                    <ArrowRight className="size-3" />
                  </Link>
                )}
              </li>
            );
          })}
          {critical
            .filter((r) => r.ok)
            .map((r) => (
              <li
                key={r.requirement}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                {r.requirement}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
