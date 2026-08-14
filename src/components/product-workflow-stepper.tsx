import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProductWorkflow, STEP_META, type WorkflowRow } from "@/lib/product-workflow.functions";
import {
  Sparkles,
  PenTool,
  FileText,
  DollarSign,
  Scissors,
  ShoppingBag,
  Crown,
  ShieldCheck,
  Factory,
  Circle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  Sparkles,
  PenTool,
  FileText,
  DollarSign,
  Scissors,
  ShoppingBag,
  Crown,
  ShieldCheck,
  Factory,
} as const;

function Icon({ name, className }: { name: string; className?: string }) {
  const Comp =
    (ICONS as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Circle;
  return <Comp className={className} />;
}

/**
 * Compact horizontal stepper for the product workspace header.
 * Shares the `product-workflow` query cache with `ProductWorkflowPanel`,
 * so both stay in sync without extra fetches.
 */
export function ProductWorkflowStepper({ productId }: { productId: string }) {
  const list = useServerFn(listProductWorkflow);
  const q = useQuery({
    queryKey: ["product-workflow", productId],
    queryFn: () => list({ data: { productId } }),
    staleTime: 15_000,
  });

  const rows: WorkflowRow[] = q.data ?? [];
  const done = rows.filter((r) => r.status === "concluido").length;
  const total = rows.length || 9;
  const pct = Math.round((done / total) * 100);
  const current = rows.find((r) => r.status === "em_andamento" || r.status === "bloqueado");
  const blocked = current?.status === "bloqueado";

  if (q.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Carregando fluxo…
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Fluxo do produto
          <span className="text-foreground/80 normal-case tracking-normal font-semibold">
            {done}/{total} · {pct}%
          </span>
        </div>
        {current && (
          <div
            className={cn(
              "text-[11px] flex items-center gap-1 font-medium",
              blocked ? "text-rose-600" : "text-primary",
            )}
          >
            {blocked && <AlertTriangle className="size-3" />}
            Atual: {STEP_META[current.step].label}
          </div>
        )}
      </div>
      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {rows.map((r, idx) => {
          const meta = STEP_META[r.step];
          const isCurrent = r.id === current?.id;
          const isDone = r.status === "concluido";
          const isBlocked = r.status === "bloqueado";
          return (
            <li key={r.id} className="flex items-center gap-1 shrink-0">
              <div
                title={`${meta.label} · ${r.status}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition",
                  isDone &&
                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  isCurrent && !isBlocked && "border-primary/60 bg-primary/10 text-primary",
                  isBlocked && "border-rose-500/50 bg-rose-500/10 text-rose-600",
                  !isDone &&
                    !isCurrent &&
                    !isBlocked &&
                    "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <Icon name={meta.icon} className="size-3" />
                )}
                <span className="hidden md:inline whitespace-nowrap">
                  {r.step_order}. {meta.label}
                </span>
                <span className="md:hidden font-semibold tabular-nums">{r.step_order}</span>
              </div>
              {idx < rows.length - 1 && (
                <div
                  className={cn("h-px w-3 shrink-0", isDone ? "bg-emerald-500/40" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
