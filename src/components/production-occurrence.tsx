import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, Send, Plus, Minus, Equal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Kind = "positiva" | "negativa" | "neutra";

const KIND_META: Record<Kind, { label: string; hint: string; tone: string; icon: typeof Plus }> = {
  positiva: {
    label: "Positiva",
    hint: "produziu além do programado",
    tone: "bg-success/15 text-success border-success/30",
    icon: Plus,
  },
  negativa: {
    label: "Negativa",
    hint: "perda não recuperável",
    tone: "bg-destructive/15 text-destructive border-destructive/30",
    icon: Minus,
  },
  neutra: {
    label: "Neutra",
    hint: "evento sem impacto no saldo",
    tone: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    icon: Equal,
  },
};

export function ProductionOccurrenceButton({
  orderId,
  orderCode,
  ownerId,
  stage,
  batchId,
}: {
  orderId: string;
  orderCode: string;
  ownerId: string;
  stage: string;
  batchId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useQuery({
    queryKey: ["po-occurrences-count", orderId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("production_occurrences")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .neq("status", "resolvida");
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
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
              Ocorrência ·{" "}
              <span className="font-mono text-xs text-muted-foreground">{orderCode}</span>
            </DialogTitle>
          </DialogHeader>
          <Form
            orderId={orderId}
            ownerId={ownerId}
            stage={stage}
            batchId={batchId}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Form({
  orderId,
  ownerId,
  stage,
  batchId,
  onDone,
}: {
  orderId: string;
  ownerId: string;
  stage: string;
  batchId?: string | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("negativa");
  const [qty, setQty] = useState<string>("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const text = body.trim();
      if (!text) throw new Error("Descreva a ocorrência");
      const n = Number(qty);
      if (kind !== "neutra" && (!Number.isFinite(n) || n <= 0)) {
        throw new Error("Informe a quantidade afetada");
      }
      const affected = kind === "neutra" ? Number(qty) || 0 : n;

      const { error: occErr } = await supabase.from("production_occurrences").insert({
        owner_id: ownerId,
        order_id: orderId,
        batch_id: batchId ?? null,
        kind,
        sector: stage,
        responsible_id: user.id,
        affected_qty: affected,
        status: "aberta",
        description: text + (photo.trim() ? `\nFoto: ${photo.trim()}` : ""),
      });
      if (occErr) throw occErr;

      // also leave a short trace on the OP comments timeline
      const sign = kind === "positiva" ? "+" : kind === "negativa" ? "−" : "·";
      await supabase.from("production_order_comments").insert({
        production_order_id: orderId,
        owner_id: ownerId,
        author_id: user.id,
        body: `[ocorrência:${kind}] ${sign}${affected} pç · ${stage} — ${text}`,
      });
    },
    onSuccess: () => {
      toast.success("Ocorrência registrada");
      qc.invalidateQueries({ queryKey: ["po-occurrences-count", orderId] });
      qc.invalidateQueries({ queryKey: ["lote-occ"] });
      qc.invalidateQueries({ queryKey: ["po-comments", orderId] });
      qc.invalidateQueries({ queryKey: ["po-comments-count", orderId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const Icon = KIND_META[k].icon;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`text-xs px-2 py-1.5 rounded border transition flex flex-col items-center gap-0.5 ${kind === k ? KIND_META[k].tone : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="size-3.5" />
                {KIND_META[k].label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{KIND_META[kind].hint}</p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Quantidade afetada {kind === "neutra" ? "(opcional)" : "(peças)"}
        </label>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={kind === "positiva" ? "+20" : kind === "negativa" ? "15" : "0"}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          O que aconteceu? · setor {stage}
        </label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ex: produzimos a mais por aproveitamento de retalho / 15 peças perdidas por falha de máquina / silk torto será refeito…"
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
        Positiva aumenta produção final · Negativa reduz · Neutra só registra evento (não altera
        saldo).
      </p>
    </form>
  );
}
