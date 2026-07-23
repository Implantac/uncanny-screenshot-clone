import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ShieldAlert, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type GateRow = {
  requirement: string;
  ok: boolean;
  detail: string | null;
};

/**
 * StageGateBadge — mostra o status dos gates de liberação do produto para produção.
 * Alimentado por public.product_gate_status(product_id): ficha aprovada, BOM, custo,
 * medidas, protótipo aprovado, fornecedor. Advisory por enquanto — não bloqueia,
 * apenas expõe os requisitos para o time.
 */
export function StageGateBadge({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Loader2 className="size-3 animate-spin" /> Gates
      </Badge>
    );
  }

  const gates = data ?? [];
  const missing = gates.filter((g) => !g.ok);
  const ready = missing.length === 0 && gates.length > 0;

  const trigger = (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      style={{
        borderColor: ready
          ? "hsl(var(--success) / 0.4)"
          : missing.length >= 3
            ? "hsl(var(--destructive) / 0.4)"
            : "hsl(38 92% 50% / 0.4)",
        color: ready
          ? "hsl(var(--success))"
          : missing.length >= 3
            ? "hsl(var(--destructive))"
            : "hsl(38 92% 40%)",
        backgroundColor: ready
          ? "hsl(var(--success) / 0.1)"
          : missing.length >= 3
            ? "hsl(var(--destructive) / 0.1)"
            : "hsl(38 92% 50% / 0.1)",
      }}
      aria-label={
        ready
          ? "Todos os gates atendidos"
          : `${missing.length} de ${gates.length} requisitos pendentes`
      }
    >
      {ready ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <ShieldAlert className="size-3.5" />
      )}
      {ready
        ? "Pronto para produção"
        : `${gates.length - missing.length}/${gates.length} gates`}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-3">
          <div className="text-sm font-semibold">Stage Gates</div>
          <div className="text-xs text-muted-foreground">
            Requisitos para liberar produção
          </div>
        </div>
        <ul className="divide-y">
          {gates.map((g) => (
            <li key={g.requirement} className="flex items-start gap-2 p-3">
              {g.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-success mt-0.5" />
              ) : (
                <XCircle className="size-4 shrink-0 text-destructive mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{g.requirement}</div>
                {g.detail && (
                  <div className="text-xs text-muted-foreground">
                    {g.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!ready && (
          <div className="border-t bg-muted/30 p-3 text-xs text-muted-foreground">
            Complete os itens acima antes de mover o produto para{" "}
            <strong>active</strong> no ciclo de vida.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
