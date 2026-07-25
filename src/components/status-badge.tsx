import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Central mapping of domain statuses -> semantic colors.
 * Semânticas: verde = aprovado/ok; amarelo = pendente/ajuste; vermelho = bloqueio/erro; azul = em andamento; cinza = neutro.
 * Never hardcode status colors in components — always route through here.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
};

// Product lifecycle / product_status
const PRODUCT: Record<string, { tone: StatusTone; label: string }> = {
  rascunho: { tone: "neutral", label: "Rascunho" },
  desenvolvimento: { tone: "info", label: "Desenvolvimento" },
  aprovado: { tone: "success", label: "Aprovado" },
  producao: { tone: "primary", label: "Produção" },
  descontinuado: { tone: "danger", label: "Descontinuado" },
};

// prototype_stage
const PROTOTYPE: Record<string, { tone: StatusTone; label: string }> = {
  solicitado: { tone: "neutral", label: "Solicitado" },
  em_confeccao: { tone: "info", label: "Em confecção" },
  em_prova: { tone: "warning", label: "Em prova" },
  aprovado: { tone: "success", label: "Aprovado" },
  reprovado: { tone: "danger", label: "Reprovado" },
};

// production_status
const PRODUCTION: Record<string, { tone: StatusTone; label: string }> = {
  aguardando: { tone: "neutral", label: "Aguardando" },
  em_producao: { tone: "info", label: "Em produção" },
  concluida: { tone: "success", label: "Concluída" },
  atrasada: { tone: "warning", label: "Atrasada" },
  cancelada: { tone: "danger", label: "Cancelada" },
};

// tech_sheet_status
const TECHSHEET: Record<string, { tone: StatusTone; label: string }> = {
  rascunho: { tone: "neutral", label: "Rascunho" },
  em_revisao: { tone: "warning", label: "Em revisão" },
  aprovada: { tone: "success", label: "Aprovada" },
};

// Generic "adjustment" style
const ADJUSTMENT: Record<string, { tone: StatusTone; label: string }> = {
  aberto: { tone: "warning", label: "Aberto" },
  em_andamento: { tone: "info", label: "Em andamento" },
  concluido: { tone: "success", label: "Concluído" },
  cancelado: { tone: "neutral", label: "Cancelado" },
};

// collection_status
const COLLECTION: Record<string, { tone: StatusTone; label: string }> = {
  briefing: { tone: "neutral", label: "Briefing" },
  design: { tone: "info", label: "Design" },
  aprovacao: { tone: "warning", label: "Aprovação" },
  desenvolvimento: { tone: "warning", label: "Desenvolvimento" },
  producao: { tone: "primary", label: "Produção" },
  entregue: { tone: "success", label: "Entregue" },
  lancamento: { tone: "success", label: "Lançamento" },
  markdown: { tone: "warning", label: "Markdown" },
  descontinuada: { tone: "danger", label: "Descontinuada" },
};

const KINDS = {
  product: PRODUCT,
  prototype: PROTOTYPE,
  production: PRODUCTION,
  techsheet: TECHSHEET,
  adjustment: ADJUSTMENT,
  collection: COLLECTION,
} as const;


export type StatusKind = keyof typeof KINDS;

export function resolveStatus(kind: StatusKind, value: string): { tone: StatusTone; label: string } {
  return (KINDS[kind] as Record<string, { tone: StatusTone; label: string }>)[value] ?? {
    tone: "neutral",
    label: value,
  };
}

export function StatusBadge({
  kind,
  value,
  className,
  compact,
}: {
  kind: StatusKind;
  value: string | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!value) return null;
  const { tone, label } = resolveStatus(kind, value);
  return (
    <Badge
      variant="outline"
      className={cn(TONE_CLASS[tone], compact && "text-[10px] px-1.5 py-0", className)}
    >
      {label}
    </Badge>
  );
}
