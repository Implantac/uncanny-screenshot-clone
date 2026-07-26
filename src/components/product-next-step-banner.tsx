import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type GateRow = { requirement: string; ok: boolean; detail: string | null };

// Ordem canônica do fluxo PLM — o primeiro gate falho vira o "próximo passo"
const STEP_ORDER = [
  "BOM (materiais)",
  "Ficha técnica aprovada",
  "Custo definido",
  "Protótipo aprovado",
] as const;

const STEP_META: Record<
  string,
  { anchor: string; cta: string; why: string }
> = {
  "BOM (materiais)": {
    anchor: "bom",
    cta: "Montar BOM",
    why: "Sem lista de materiais o custo não fecha e o MRP não sabe o que comprar.",
  },
  "Ficha técnica aprovada": {
    anchor: "ficha",
    cta: "Abrir ficha técnica",
    why: "A ficha é o contrato com a fábrica — tecido, medidas, aviamentos e sequência.",
  },
  "Custo definido": {
    anchor: "custos",
    cta: "Definir custo",
    why: "Sem custo o comercial não precifica e o PCP não libera OP.",
  },
  "Protótipo aprovado": {
    anchor: "prototipos",
    cta: "Aprovar piloto",
    why: "Ao menos uma peça piloto precisa estar aprovada antes de escalar.",
  },
};

/**
 * Banner persistente acima das tabs — mostra UM próximo passo claro.
 * Reaproveita o cache key `product-gate-status` (mesmo query do ReadinessCard/Badge).
 */
export function ProductNextStepBanner({ productId }: { productId: string }) {
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

  const failing = new Set(
    q.data.filter((r) => !r.ok).map((r) => r.requirement),
  );

  if (failing.size === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-400">
          Produto pronto para produção.
        </span>
        <span className="text-muted-foreground text-xs">
          Todos os gates críticos passaram — pode abrir OP a qualquer momento.
        </span>
      </div>
    );
  }

  const next = STEP_ORDER.find((s) => failing.has(s));
  if (!next) return null;
  const meta = STEP_META[next];
  const idx = STEP_ORDER.indexOf(next) + 1;

  return (
    <Link
      to="/produto/$id"
      params={{ id: productId }}
      hash={meta.anchor}
      className="group block rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 hover:border-primary/50 hover:bg-primary/10 transition"
    >
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-primary/15 grid place-items-center shrink-0">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wide text-primary/80">
              Próximo passo · {idx}/{STEP_ORDER.length}
            </span>
          </div>
          <div className="text-sm font-semibold truncate">{next}</div>
          <div className="text-xs text-muted-foreground truncate">
            {meta.why}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium shrink-0 group-hover:translate-x-0.5 transition">
          {meta.cta}
          <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
