import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Severity = "baixa" | "media" | "critica";

const SEVERITY: Record<Severity, { label: string; tone: string; defects: { minor: number; major: number; critical: number } }> = {
  baixa:   { label: "Baixa",   tone: "bg-muted text-muted-foreground border-border",                       defects: { minor: 1, major: 0, critical: 0 } },
  media:   { label: "Média",   tone: "bg-orange-500/15 text-orange-500 border-orange-500/30",              defects: { minor: 0, major: 1, critical: 0 } },
  critica: { label: "Crítica", tone: "bg-destructive/15 text-destructive border-destructive/30",           defects: { minor: 0, major: 0, critical: 1 } },
};

const TAG_PREFIX = "[ocorrência:";

export function ProductionOccurrenceButton({
  orderId,
  orderCode,
  ownerId,
  stage,
}: {
  orderId: string;
  orderCode: string;
  ownerId: string;
  stage: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useQuery({
    queryKey: ["po-occurrences-count", orderId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("production_order_comments")
        .select("id", { count: "exact", head: true })
        .eq("production_order_id", orderId)
        .ilike("body", `${TAG_PREFIX}%`);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Registrar ocorrência"
        className={`relative inline-flex items-center gap-0.5 h-6 px-1.5 rounded text-[10px] border transition ${count > 0 ? "border-destructive/40 text-destructive bg-destructive/10" : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"}`}
      >
        <AlertOctagon className="size-3" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertOctagon className="size-4 text-destructive" />
              Ocorrência · <span className="font-mono text-xs text-muted-foreground">{orderCode}</span>
            </DialogTitle>
          </DialogHeader>
          <Form
            orderId={orderId}
            ownerId={ownerId}
            stage={stage}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Form({ orderId, ownerId, stage, onDone }: { orderId: string; ownerId: string; stage: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [severity, setSeverity] = useState<Severity>("media");
  const [linha, setLinha] = useState<1 | 2>(1);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const text = body.trim();
      if (!text) throw new Error("Descreva a ocorrência");
      const linhaTag = linha === 2 ? ":2L" : "";
      const tagged = `${TAG_PREFIX}${severity}${linhaTag}] ${text}${photo.trim() ? `\nFoto: ${photo.trim()}` : ""}`;

      const { error: cErr } = await supabase.from("production_order_comments").insert({
        production_order_id: orderId,
        owner_id: ownerId,
        author_id: user.id,
        body: tagged,
      });
      if (cErr) throw cErr;

      const d = SEVERITY[severity].defects;
      const { error: qErr } = await supabase.from("quality_inspections").insert({
        owner_id: ownerId,
        production_order_id: orderId,
        inspection_type: `ocorrencia:${stage}${linha === 2 ? ":2a-linha" : ""}`,
        inspector: user.email ?? null,
        result: severity === "critica" ? "reprovada" : "condicional",
        minor_defects: d.minor,
        major_defects: d.major,
        critical_defects: d.critical,
        notes: text,
        attachments: photo.trim() ? [{ url: photo.trim() }] : [],
      });
      if (qErr) throw qErr;
    },
    onSuccess: () => {
      toast.success("Ocorrência registrada");
      qc.invalidateQueries({ queryKey: ["po-occurrences-count", orderId] });
      qc.invalidateQueries({ queryKey: ["po-comments", orderId] });
      qc.invalidateQueries({ queryKey: ["po-comments-count", orderId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Severidade</label>
        <div className="flex gap-1.5">
          {(Object.keys(SEVERITY) as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`flex-1 text-xs px-2 py-1.5 rounded border transition ${severity === s ? SEVERITY[s].tone : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {SEVERITY[s].label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Destino da peça</label>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setLinha(1)}
            className={`flex-1 text-xs px-2 py-1.5 rounded border transition ${linha === 1 ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:bg-muted"}`}>
            1ª linha (recupera)
          </button>
          <button type="button" onClick={() => setLinha(2)}
            className={`flex-1 text-xs px-2 py-1.5 rounded border transition ${linha === 2 ? "bg-amber-500/15 text-amber-500 border-amber-500/30" : "border-border text-muted-foreground hover:bg-muted"}`}>
            2ª linha (outlet)
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">O que aconteceu? · setor {stage}</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ex: lote parado por falha de máquina, defeito na costura, falta de aviamento…"
          className="min-h-[80px] resize-none"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Foto (URL opcional)</label>
        <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!body.trim() || submit.isPending}>
          <Send className="size-3.5 mr-1" /> Registrar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Salva uma observação na OP e abre uma inspeção de qualidade vinculada — sem criar tela nova.
      </p>
    </form>
  );
}
