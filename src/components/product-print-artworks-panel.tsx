import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Sparkles, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "Rascunho", tone: "bg-muted text-muted-foreground border-border" },
  aguardando_prova: {
    label: "Aguardando prova",
    tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  em_prova: {
    label: "Em prova",
    tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  aprovada: {
    label: "Aprovada",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  liberada_producao: {
    label: "Liberada p/ produção",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  rejeitada: { label: "Rejeitada", tone: "bg-destructive/15 text-destructive border-destructive/30" },
};

const PENDING_STATES = new Set(["rascunho", "aguardando_prova", "em_prova"]);

export function ProductPrintArtworksPanel({ productId }: { productId: string }) {
  useRealtime("print_artworks", ["product-print-artworks", productId]);
  const { data: artworks = [], isLoading } = useQuery({
    queryKey: ["product-print-artworks", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_artworks")
        .select("id, name, technique, status, updated_at")
        .eq("product_id", productId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return null;
  if (artworks.length === 0) return null;

  const anyPending = artworks.some((a) => PENDING_STATES.has(a.status as string));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Estampas, Silk & Bordado</h3>
        </div>
        <Link
          to="/estampas"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Abrir módulo <ExternalLink className="size-3" />
        </Link>
      </div>

      {anyPending && (
        <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span>
            Há artes pendentes — o PCP não conseguirá avançar OPs deste produto de Corte para Silk/Bordado/Costura até a aprovação.
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {artworks.map((a) => {
          const meta = STATUS_META[a.status as string] ?? STATUS_META.rascunho;
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="uppercase text-[9px] tracking-wide text-muted-foreground shrink-0">
                  {a.technique}
                </span>
                <span className="font-medium truncate">{a.name}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${meta.tone} shrink-0`}>
                {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
