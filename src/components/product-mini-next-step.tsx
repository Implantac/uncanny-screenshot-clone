import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type GateRow = { requirement: string; ok: boolean; detail: string | null };

const STEP_ORDER = [
  "BOM (materiais)",
  "Ficha técnica aprovada",
  "Custo definido",
  "Protótipo aprovado",
] as const;

const STEP_SHORT: Record<string, string> = {
  "BOM (materiais)": "Montar BOM",
  "Ficha técnica aprovada": "Criar ficha",
  "Custo definido": "Definir custo",
  "Protótipo aprovado": "Aprovar piloto",
};

const STEP_ANCHOR: Record<string, string> = {
  "BOM (materiais)": "bom",
  "Ficha técnica aprovada": "ficha",
  "Custo definido": "custos",
  "Protótipo aprovado": "prototipos",
};

/**
 * Versão compacta do "próximo passo" para listas/cards.
 * Reutiliza o cache key `product-gate-status` — não dispara query extra.
 * Quando não há pendência, mostra apenas o selo "Pronto".
 */
export function ProductMiniNextStep({ productId }: { productId: string }) {
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

  const failing = new Set(q.data.filter((r) => !r.ok).map((r) => r.requirement));
  if (failing.size === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Pronto p/ produção
      </span>
    );
  }

  const next = STEP_ORDER.find((s) => failing.has(s));
  if (!next) return null;

  return (
    <Link
      to="/produto/$id"
      params={{ id: productId }}
      hash={STEP_ANCHOR[next]}
      onClick={(e) => e.stopPropagation()}
      className="group inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
    >
      <Sparkles className="size-3" />
      {STEP_SHORT[next]}
      <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
