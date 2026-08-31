import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

export type ProductStatus =
  | "rascunho"
  | "desenvolvimento"
  | "aprovado"
  | "producao"
  | "descontinuado";

const FLOW: ProductStatus[] = [
  "rascunho",
  "desenvolvimento",
  "aprovado",
  "producao",
  "descontinuado",
];

const LABEL: Record<ProductStatus, string> = {
  rascunho: "Rascunho",
  desenvolvimento: "Desenvolvimento",
  aprovado: "Aprovado",
  producao: "Produção",
  descontinuado: "Descontinuado",
};

/**
 * Controle manual do ciclo de vida do produto: o usuário avança, retrocede
 * ou descontinua a peça diretamente no workspace do produto.
 */
export function ProductStatusControl({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState<ProductStatus | null>(null);
  const current = (FLOW.includes(status as ProductStatus) ? status : "rascunho") as ProductStatus;
  const idx = FLOW.indexOf(current);

  const change = useMutation({
    mutationFn: async (to: ProductStatus) => {
      const { error } = await supabase.from("products").update({ status: to }).eq("id", productId);
      if (error) throw error;
      return to;
    },
    onSuccess: (to) => {
      toast.success(`Produto → ${LABEL[to]}`);
      qc.invalidateQueries({ queryKey: ["product-workspace", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setPending(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPending(null);
    },
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <div className="text-sm font-semibold">Ciclo de vida do produto</div>
        <div className="ms-auto">
          <StatusBadge kind="product" value={current} />
        </div>
      </header>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {FLOW.map((s, i) => (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!user || s === current || change.isPending}
              onClick={() => {
                setPending(s);
                change.mutate(s);
              }}
              className={`px-2 py-1 rounded text-[11px] transition ${
                i === idx
                  ? "bg-primary/15 text-primary font-medium ring-1 ring-primary/30"
                  : i < idx
                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                    : "bg-muted/30 text-muted-foreground/70 hover:bg-muted/60"
              } ${pending === s ? "opacity-60" : ""} disabled:cursor-default`}
            >
              {LABEL[s]}
            </button>
            {i < FLOW.length - 1 && (
              <ChevronRight className="size-3 text-muted-foreground/40" aria-hidden />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {idx > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!user || change.isPending}
            onClick={() => change.mutate(FLOW[idx - 1]!)}
          >
            Voltar para {LABEL[FLOW[idx - 1]!]}
          </Button>
        )}
        {idx < FLOW.length - 1 && (
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!user || change.isPending}
            onClick={() => change.mutate(FLOW[idx + 1]!)}
          >
            Avançar para {LABEL[FLOW[idx + 1]!]}
          </Button>
        )}
      </div>
      {!user && (
        <p className="text-[11px] text-muted-foreground">
          Entre na sua conta para alterar o ciclo de vida do produto.
        </p>
      )}
    </section>
  );
}
