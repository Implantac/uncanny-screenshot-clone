import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, GitBranch, Sparkles, TriangleAlert } from "lucide-react";
import {
  COLLECTION_STATES,
  STATE_META,
  type CollectionState,
  previewTransition,
  transitionCollection,
} from "@/lib/lifecycle.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LifecyclePanel({
  collectionId,
  collectionName,
  currentState,
}: {
  collectionId: string;
  collectionName: string;
  currentState: CollectionState;
}) {
  const previewFn = useServerFn(previewTransition);
  const transitionFn = useServerFn(transitionCollection);
  const qc = useQueryClient();
  const [target, setTarget] = useState<CollectionState | null>(null);
  const [reason, setReason] = useState("");

  const meta = STATE_META[currentState] ?? STATE_META.briefing;
  const nextOptions = meta.next;

  const preview = useQuery({
    queryKey: ["lifecycle-preview", collectionId, target],
    queryFn: () => previewFn({ data: { collectionId, to: target! } }),
    enabled: !!target,
    staleTime: 0,
  });

  const mut = useMutation({
    mutationFn: () =>
      transitionFn({
        data: { collectionId, to: target!, reason: reason.trim() || null },
      }),
    onSuccess: (r) => {
      toast.success(`${STATE_META[r.from].label} → ${STATE_META[r.to].label}`);
      setTarget(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["carry-over", collectionId] });
      qc.invalidateQueries({ queryKey: ["assortment", collectionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const idx = COLLECTION_STATES.indexOf(currentState);

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <div className="font-medium text-sm">Ciclo de Vida</div>
        <span className="text-xs text-muted-foreground truncate">— {collectionName}</span>
        <span
          className={`ms-auto inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${meta.tone}`}
        >
          {meta.label}
        </span>
      </header>

      {/* timeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {COLLECTION_STATES.map((s, i) => {
          const sm = STATE_META[s];
          const past = i < idx;
          const current = i === idx;
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <div
                className={`px-2 py-0.5 rounded text-[10px] ${
                  current
                    ? sm.tone + " ring-1 ring-current font-medium"
                    : past
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted/30 text-muted-foreground/60"
                }`}
              >
                {sm.label}
              </div>
              {i < COLLECTION_STATES.length - 1 && (
                <ChevronRight className="size-3 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>

      {nextOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center">Próximo:</span>
          {nextOptions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setTarget(s);
                setReason("");
              }}
            >
              {STATE_META[s].label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">
          Coleção descontinuada — nenhuma transição disponível.
        </div>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {STATE_META[currentState].label}
              <ChevronRight className="inline size-4 mx-1" />
              {target && STATE_META[target].label}
            </DialogTitle>
          </DialogHeader>
          {preview.isLoading ? (
            <div className="text-xs text-muted-foreground py-4">Analisando…</div>
          ) : preview.data ? (
            <div className="space-y-3">
              {preview.data.warnings.length > 0 && (
                <div className="space-y-1">
                  {preview.data.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="text-xs rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1.5 flex items-start gap-2"
                    >
                      <TriangleAlert className="size-3.5 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {preview.data.effects.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium flex items-center gap-1">
                    <Sparkles className="size-3" /> Ações automáticas
                  </div>
                  {preview.data.effects.map((e, i) => (
                    <div
                      key={i}
                      className="text-xs rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
                    >
                      {e}
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">
                  Motivo (opcional, fica registrado em auditoria)
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Ex.: Sell-through abaixo de 40% após 4 semanas — abrir markdown."
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              Confirmar transição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
