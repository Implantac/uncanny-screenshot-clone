import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Semáforo de SLA para aprovações pendentes: <24h verde, 24–48h âmbar, >48h vermelho. */
export function ApprovalSlaBadge({
  createdAt,
  className,
}: {
  createdAt: string;
  className?: string;
}) {
  const ageMs = Date.now() - Date.parse(createdAt);
  const ageH = Math.max(0, Math.floor(ageMs / 3_600_000));
  const label =
    ageH < 1
      ? "<1h"
      : ageH < 48
        ? `${ageH}h`
        : `${Math.floor(ageH / 24)}d`;

  const tone =
    ageH >= 48
      ? "bg-red-500/15 text-red-600 border-red-500/30"
      : ageH >= 24
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";

  const title =
    ageH >= 168
      ? "Escalonada — parada há mais de 7 dias"
      : ageH >= 48
        ? "Fora do SLA — lembrete automático enviado"
        : ageH >= 24
          ? "Perto do limite de 48h"
          : "Dentro do SLA";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        tone,
        className,
      )}
    >
      <Clock className="size-3" />
      {label}
    </span>
  );
}
