import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getHandoffTimeline,
  registerHandoff,
} from "@/lib/prototype-gates.functions";
import { SECTORS } from "@/components/prototype-adjustments";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PrototypeHandoffTimeline({
  prototypeId,
  currentSector,
}: {
  prototypeId: string;
  currentSector: string | null;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getHandoffTimeline);
  const regFn = useServerFn(registerHandoff);
  const [open, setOpen] = useState(false);
  const [toSector, setToSector] = useState("");
  const [event, setEvent] = useState("entrega");
  const [notes, setNotes] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["proto-handoff", prototypeId],
    queryFn: () => getFn({ data: { prototypeId } }),
  });

  const register = useMutation({
    mutationFn: () =>
      regFn({
        data: {
          prototypeId,
          fromSector: currentSector,
          toSector,
          event,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proto-handoff", prototypeId] });
      qc.invalidateQueries({ queryKey: ["prototipo", prototypeId] });
      toast.success("Passagem registrada");
      setOpen(false);
      setToSector("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = (k: string | null | undefined) =>
    k ? (SECTORS.find((s) => s.key === k)?.label ?? k) : "—";

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="size-4 text-primary" />
        <div className="text-sm font-semibold">Passagem entre setores</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="ml-auto h-7">
              + Registrar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar passagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Setor atual: <b>{label(currentSector)}</b>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={toSector} onValueChange={setToSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Para setor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={event} onValueChange={setEvent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrega">Entrega</SelectItem>
                    <SelectItem value="devolucao">Devolução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Observação (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!toSector || register.isPending}
                onClick={() => register.mutate()}
              >
                {register.isPending && <Loader2 className="size-3 mr-1 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Carregando…
        </div>
      ) : events.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center rounded-lg border border-dashed border-border">
          Nenhuma passagem registrada ainda.
        </div>
      ) : (
        <ol className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <span className="text-xs font-medium">{label(e.from_sector)}</span>
              <ArrowRight className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">{label(e.to_sector)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  e.event === "devolucao"
                    ? "bg-amber-500/15 text-amber-700"
                    : "bg-emerald-500/15 text-emerald-700"
                }`}
              >
                {e.event}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {new Date(e.created_at).toLocaleString("pt-BR")}
              </span>
              {e.notes && (
                <div className="w-full text-[11px] text-muted-foreground mt-1 basis-full">
                  {e.notes}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
