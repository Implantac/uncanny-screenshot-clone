import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listProductWorkflow,
  advanceProductWorkflow,
  STEP_META,
  type WorkflowRow,
  type WorkflowStep,
} from "@/lib/product-workflow.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const ICONS = {
  Sparkles, PenTool, FileText, DollarSign, Scissors,
  ShoppingBag, Crown, ShieldCheck, Factory,
} as const;

function Icon({ name, className }: { name: string; className?: string }) {
  const Comp = (ICONS as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Circle;
  return <Comp className={className} />;
}

const STATUS_STYLE: Record<
  WorkflowRow["status"],
  { dot: string; badge: string; label: string }
> = {
  pendente:      { dot: "bg-muted-foreground/40",  badge: "bg-muted text-muted-foreground",                 label: "Pendente" },
  em_andamento:  { dot: "bg-blue-500",             badge: "bg-blue-500/15 text-blue-600 border-blue-500/30", label: "Em andamento" },
  concluido:     { dot: "bg-emerald-500",          badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", label: "Concluído" },
  bloqueado:     { dot: "bg-rose-500",             badge: "bg-rose-500/15 text-rose-600 border-rose-500/30", label: "Bloqueado" },
};

export function ProductWorkflowPanel({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listProductWorkflow);
  const advance = useServerFn(advanceProductWorkflow);
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);

  const q = useQuery({
    queryKey: ["product-workflow", productId],
    queryFn: () => list({ data: { productId } }),
    staleTime: 15_000,
  });

  const advanceM = useMutation({
    mutationFn: (n?: string) => advance({ data: { productId, note: n || null } }),
    onSuccess: (r) => {
      if (!r.advanced) {
        toast.error("Etapa bloqueada", {
          description: r.blockers?.[0] ?? "Requisitos incompletos",
        });
      } else if (r.to_step) {
        toast.success(`Etapa concluída → ${STEP_META[r.to_step as WorkflowStep]?.label ?? r.to_step}`);
      } else {
        toast.success("Workflow finalizado 🎉");
      }
      setNote("");
      qc.invalidateQueries({ queryKey: ["product-workflow", productId] });
      qc.invalidateQueries({ queryKey: ["product-events", productId] });
      qc.invalidateQueries({ queryKey: ["my-workflow-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const current = useMemo(
    () => rows.find((r) => r.status === "em_andamento" || r.status === "bloqueado"),
    [rows],
  );
  const done = rows.filter((r) => r.status === "concluido").length;
  const total = rows.length || 9;
  const pct = Math.round((done / total) * 100);
  const blocked = current?.status === "bloqueado";
  const blockers = (current?.blocker_reason ?? "").split("\n").filter(Boolean);
  const visible = showAll ? rows : rows.slice(0, 5);

  if (q.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando fluxo do produto…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold flex items-center gap-2">
            Workflow do produto
            <Badge variant="outline" className="text-[10px]">
              {done}/{total} · {pct}%
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Fluxo transversal Design → Modelagem → Engenharia → Custos → Piloto → Aprovações → PCP → Produção
          </div>
        </div>
        {current ? (
          <div className="text-right shrink-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Etapa atual
            </div>
            <div className={`inline-flex items-center gap-1.5 text-sm font-medium ${blocked ? "text-rose-600" : "text-blue-600"}`}>
              <Icon name={STEP_META[current.step].icon} className="size-4" />
              {STEP_META[current.step].label}
            </div>
          </div>
        ) : null}
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${blocked ? "bg-rose-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Blocker banner */}
      {blocked && blockers.length > 0 && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
          <div className="flex items-center gap-2 text-rose-600 font-medium text-sm">
            <AlertTriangle className="size-4" />
            Avanço bloqueado — resolva os itens abaixo
          </div>
          <ul className="mt-2 text-xs text-rose-700/90 dark:text-rose-300/90 list-disc pl-5 space-y-0.5">
            {blockers.slice(0, 6).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lista de etapas */}
      <ol className="space-y-1.5">
        {visible.map((r) => {
          const meta = STEP_META[r.step];
          const s = STATUS_STYLE[r.status];
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                r.id === current?.id ? "border-primary/40 bg-primary/5" : "border-border"
              }`}
            >
              <div className={`size-2 rounded-full ${s.dot} shrink-0`} />
              <div className="size-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Icon name={meta.icon} className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {r.step_order}. {meta.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {meta.role}
                  {r.completed_at ? ` · concluído ${new Date(r.completed_at).toLocaleDateString("pt-BR")}` : ""}
                  {r.started_at && !r.completed_at ? ` · iniciado ${new Date(r.started_at).toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              {r.status === "concluido" ? (
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              ) : (
                <Badge variant="outline" className={`text-[10px] ${s.badge}`}>
                  {s.label}
                </Badge>
              )}
            </li>
          );
        })}
      </ol>

      {rows.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          {showAll ? "Recolher" : `Ver todas as ${rows.length} etapas`}
        </button>
      )}

      {/* CTA */}
      {current && (
        <div className="pt-2 border-t space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota da etapa (opcional)"
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={advanceM.isPending}
          />
          <Button
            onClick={() => advanceM.mutate(note)}
            disabled={advanceM.isPending}
            className="w-full gap-1.5"
          >
            {advanceM.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {blocked ? "Tentar avançar novamente" : "Concluir etapa e avançar"}
          </Button>
          {blocked && (
            <div className="text-[11px] text-muted-foreground text-center">
              O motor de gates checará os requisitos antes de liberar a próxima etapa.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
