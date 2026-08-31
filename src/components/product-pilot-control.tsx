import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Scissors,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { PilotRequestDialog } from "@/components/pilot-request-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Stage = "solicitado" | "em_confeccao" | "em_prova" | "aprovado" | "reprovado";

const FLOW: Stage[] = ["solicitado", "em_confeccao", "em_prova", "aprovado"];
const STAGE_LABEL: Record<Stage, string> = {
  solicitado: "Solicitado",
  em_confeccao: "Em confecção",
  em_prova: "Em prova",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

type PilotRow = {
  id: string;
  code: string;
  stage: Stage;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Controle completo do ciclo de peça piloto de um produto:
 * rodadas numeradas, avanço de etapa, aprovação/reprovação com motivo
 * e abertura de nova rodada preservando o histórico.
 */
export function ProductPilotControl({
  productId,
  productSku,
  productStatus,
}: {
  productId: string;
  productSku: string;
  productStatus?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openRequest, setOpenRequest] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [lastReason, setLastReason] = useState<string | null>(null);

  const { data: pilots = [], isLoading } = useQuery({
    queryKey: ["product-pilots", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prototypes")
        .select("id, code, stage, due_date, notes, created_at, updated_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PilotRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["product-pilots", productId] });
    qc.invalidateQueries({ queryKey: ["product-workspace-protos", productId] });
    qc.invalidateQueries({ queryKey: ["pilots"] });
  };

  const setStage = useMutation({
    mutationFn: async ({
      id,
      stage,
      rejectReason,
    }: {
      id: string;
      stage: Stage;
      rejectReason?: string;
    }) => {
      const patch: Record<string, unknown> = { stage };
      if (stage === "reprovado") {
        patch['needs_adjustment'] = true;
        patch['adjustment_reason'] = rejectReason ?? null;
        patch['adjustment_requested_at'] = new Date().toISOString();
        if (user) patch['adjustment_requested_by'] = user.id;
      }
      const { error } = await supabase.from("prototypes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Piloto → ${STAGE_LABEL[v.stage]}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({ status: "aprovado" as const })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto aprovado — liberado para desenvolvimento de produção.");
      qc.invalidateQueries({ queryKey: ["product-workspace", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rounds = pilots.length;
  const active = useMemo(
    () => pilots.find((p) => p.stage !== "aprovado" && p.stage !== "reprovado") ?? null,
    [pilots],
  );
  const approved = pilots.some((p) => p.stage === "aprovado");

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <Scissors className="size-4 text-primary" />
        <div className="text-sm font-semibold">Controle de peças piloto</div>
        <span className="text-xs text-muted-foreground">
          {rounds} rodada{rounds === 1 ? "" : "s"}
          {approved ? " · piloto aprovado" : active ? ` · em andamento (${active.code})` : ""}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <Link
            to="/pilots"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            Ver todas <ExternalLink className="size-3" />
          </Link>
          <Button
            size="sm"
            className="gap-1 h-8"
            disabled={!user || !!active}
            onClick={() => setOpenRequest(true)}
          >
            <Scissors className="size-3.5" />
            {rounds === 0 ? "Solicitar piloto" : "Nova rodada"}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="h-16 rounded-lg bg-muted animate-pulse" />
      ) : rounds === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma piloto solicitada ainda. A primeira rodada inicia o ciclo Solicitado → Em confecção
          → Em prova → Aprovado.
        </p>
      ) : (
        <ol className="space-y-2">
          {pilots.map((p, i) => {
            const idx = FLOW.indexOf(p.stage);
            const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1]! : null;
            const closed = p.stage === "aprovado" || p.stage === "reprovado";
            return (
              <li
                key={p.id}
                className="rounded-lg border border-border bg-background/50 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold rounded bg-muted px-1.5 py-0.5">
                    Rodada {i + 1}
                  </span>
                  <Link
                    to="/prototipo/$id"
                    params={{ id: p.id }}
                    className="font-mono text-xs font-semibold hover:text-primary"
                  >
                    {p.code}
                  </Link>
                  <StatusBadge kind="prototype" value={p.stage} />
                  {p.due_date && (
                    <span className="text-[11px] text-muted-foreground">
                      prazo {new Date(p.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {!closed && user && (
                    <div className="ms-auto flex flex-wrap gap-1.5">
                      {next && next !== "aprovado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setStage.mutate({ id: p.id, stage: next })}
                        >
                          <ArrowRight className="size-3" /> {STAGE_LABEL[next]}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs text-emerald-600"
                        onClick={() => setStage.mutate({ id: p.id, stage: "aprovado" })}
                      >
                        <CheckCircle2 className="size-3" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs text-rose-600"
                        onClick={() => {
                          setRejectId(p.id);
                          setReason("");
                        }}
                      >
                        <XCircle className="size-3" /> Reprovar
                      </Button>
                    </div>
                  )}
                  {p.stage === "reprovado" && user && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ms-auto h-7 gap-1 text-xs"
                      disabled={!!active}
                      onClick={() => {
                        setLastReason(p.notes ?? null);
                        setOpenRequest(true);
                      }}
                    >
                      <RotateCcw className="size-3" /> Repetir piloto
                    </Button>
                  )}
                </div>
                {p.notes && <p className="text-[11px] text-muted-foreground">{p.notes}</p>}
              </li>
            );
          })}
        </ol>
      )}

      {approved && productStatus !== "aprovado" && productStatus !== "producao" && user && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-wrap items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span className="text-xs">
            Piloto aprovado — libere o produto para seguir no ciclo de vida.
          </span>
          <Button
            size="sm"
            className="ms-auto h-7 text-xs"
            disabled={approveProduct.isPending}
            onClick={() => approveProduct.mutate()}
          >
            Aprovar produto
          </Button>
        </div>
      )}

      <PilotRequestDialog
        open={openRequest}
        onOpenChange={(v) => {
          setOpenRequest(v);
          if (!v) setLastReason(null);
        }}
        productId={productId}
        productSku={productSku}
        round={rounds + 1}
        reasonHint={lastReason}
      />

      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar peça piloto</DialogTitle>
            <DialogDescription>
              O motivo fica registrado e é sugerido como instrução na próxima rodada.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: cava apertada no tamanho M e diferença de 2 cm no comprimento."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => {
                setStage.mutate({
                  id: rejectId!,
                  stage: "reprovado",
                  rejectReason: reason.trim(),
                });
                setRejectId(null);
              }}
            >
              Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
