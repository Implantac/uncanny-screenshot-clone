import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Plus, CheckCircle2, X, Image as ImageIcon, Video } from "lucide-react";

export type AdjustmentSector =
  | "modelagem" | "corte" | "silk" | "bordado" | "costura" | "lavanderia" | "acabamento" | "aprovacao";

export const SECTORS: { key: AdjustmentSector; label: string }[] = [
  { key: "modelagem", label: "Modelagem" },
  { key: "corte", label: "Corte" },
  { key: "silk", label: "Silk" },
  { key: "bordado", label: "Bordado" },
  { key: "costura", label: "Costura" },
  { key: "lavanderia", label: "Lavanderia" },
  { key: "acabamento", label: "Acabamento" },
  { key: "aprovacao", label: "Aprovação" },
];

type Attachment = { url: string; kind: "photo" | "video"; name?: string };
type Adjustment = {
  id: string;
  prototype_id: string;
  owner_id: string;
  sector: AdjustmentSector | null;
  reason: string;
  requested_by: string | null;
  assignee_id: string | null;
  status: "aberto" | "em_andamento" | "concluido" | "cancelado";
  notes: string | null;
  attachments: Attachment[];
  resolved_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<Adjustment["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const STATUS_TONE: Record<Adjustment["status"], string> = {
  aberto: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  em_andamento: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  concluido: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export function PrototypeAdjustmentsButton({
  prototypeId,
  prototypeCode,
  defaultSector,
  needsAdjustment,
}: {
  prototypeId: string;
  prototypeCode: string;
  defaultSector?: AdjustmentSector | null;
  needsAdjustment?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant={needsAdjustment ? "default" : "ghost"}
        className={needsAdjustment ? "h-7 px-2 bg-amber-500 hover:bg-amber-500/90 text-white" : "h-7 px-2"}
        onClick={() => setOpen(true)}
        title="Ajustes"
      >
        <AlertTriangle className="size-3.5 mr-1" />
        <span className="text-xs">Ajustes</span>
      </Button>
      {open && (
        <AdjustmentsDialog
          open={open}
          onOpenChange={setOpen}
          prototypeId={prototypeId}
          prototypeCode={prototypeCode}
          defaultSector={defaultSector ?? null}
        />
      )}
    </>
  );
}

function AdjustmentsDialog({
  open, onOpenChange, prototypeId, prototypeCode, defaultSector,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prototypeId: string;
  prototypeCode: string;
  defaultSector: AdjustmentSector | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [sector, setSector] = useState<AdjustmentSector | "">(defaultSector ?? "");
  const [notes, setNotes] = useState("");
  const [attachInput, setAttachInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["prototype-adjustments", prototypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prototype_adjustments" as never)
        .select("*")
        .eq("prototype_id", prototypeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Adjustment[];
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!reason.trim()) throw new Error("Informe o motivo do ajuste");
      const payload = {
        prototype_id: prototypeId,
        owner_id: user.id,
        sector: sector || null,
        reason: reason.trim(),
        requested_by: user.id,
        status: "aberto" as const,
        notes: notes.trim() || null,
        attachments,
      };
      const { error } = await supabase.from("prototype_adjustments" as never).insert(payload as never);
      if (error) throw error;

      // sinaliza no protótipo (último ajuste em aberto)
      await supabase
        .from("prototypes")
        .update({
          needs_adjustment: true,
          adjustment_reason: reason.trim(),
          adjustment_requested_by: user.id,
          adjustment_requested_at: new Date().toISOString(),
          ...(sector ? { current_sector: sector } : {}),
        } as never)
        .eq("id", prototypeId);
    },
    onSuccess: () => {
      setReason(""); setNotes(""); setAttachments([]);
      qc.invalidateQueries({ queryKey: ["prototype-adjustments", prototypeId] });
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      toast.success("Ajuste registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("prototype_adjustments" as never)
        .update({ status: "concluido", resolved_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;

      // se não restar nenhum em aberto, limpa o flag no protótipo
      const { data: pend } = await supabase
        .from("prototype_adjustments" as never)
        .select("id")
        .eq("prototype_id", prototypeId)
        .in("status", ["aberto", "em_andamento"]);
      if (!pend || pend.length === 0) {
        await supabase
          .from("prototypes")
          .update({ needs_adjustment: false } as never)
          .eq("id", prototypeId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototype-adjustments", prototypeId] });
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      toast.success("Ajuste concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addAttachment() {
    const url = attachInput.trim();
    if (!url) return;
    const kind: Attachment["kind"] = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ? "video" : "photo";
    setAttachments((a) => [...a, { url, kind }]);
    setAttachInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Ajustes do protótipo <span className="font-mono text-sm text-muted-foreground">{prototypeCode}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={sector} onValueChange={(v) => setSector(v as AdjustmentSector)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Anexo (URL foto/vídeo)</Label>
              <div className="flex gap-1">
                <Input value={attachInput} onChange={(e) => setAttachInput(e.target.value)} placeholder="https://…" />
                <Button type="button" variant="outline" onClick={addAttachment}><Plus className="size-4" /></Button>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Motivo do ajuste *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: barra torta, cor fora do padrão…" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {a.kind === "video" ? <Video className="size-3" /> : <ImageIcon className="size-3" />}
                  <span className="max-w-[200px] truncate">{a.url}</span>
                  <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} aria-label="remover">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="size-4 mr-1" /> Registrar ajuste
            </Button>
          </DialogFooter>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Histórico</div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : list.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhum ajuste registrado.</div>
          ) : (
            <ol className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {list.map((a) => (
                <li key={a.id} className="rounded-lg border border-border p-3 space-y-1.5 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      {a.sector && <Badge variant="outline">{SECTORS.find((s) => s.key === a.sector)?.label ?? a.sector}</Badge>}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {(a.status === "aberto" || a.status === "em_andamento") && (
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => resolve.mutate(a.id)}>
                        <CheckCircle2 className="size-3.5 mr-1" /> Concluir
                      </Button>
                    )}
                  </div>
                  <div className="text-sm">{a.reason}</div>
                  {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
                  {a.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {a.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-border hover:bg-muted/40"
                        >
                          {att.kind === "video" ? <Video className="size-3" /> : <ImageIcon className="size-3" />}
                          <span className="max-w-[160px] truncate">{att.name ?? att.url}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
