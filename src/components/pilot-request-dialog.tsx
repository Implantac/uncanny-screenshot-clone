import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Solicitação de peça piloto (nova rodada) para um produto.
 * O código é gerado como {SKU}-P{rodada}, permitindo rastrear quantas vezes
 * a piloto se repetiu para a mesma peça.
 */
export function PilotRequestDialog({
  open,
  onOpenChange,
  productId,
  productSku,
  round,
  reasonHint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productSku: string;
  round: number;
  reasonHint?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState(`${productSku}-P${round}`);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setCode(`${productSku}-P${round}`);
      setNotes(reasonHint ? `Rodada ${round} — motivo: ${reasonHint}` : "");
    }
  }, [open, productSku, round, reasonHint]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-ref"],
    enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para solicitar uma peça piloto.");
      const { data, error } = await supabase
        .from("prototypes")
        .insert({
          code: code.trim(),
          product_id: productId,
          owner_id: user.id,
          stage: "solicitado" as const,
          supplier_id: supplierId === "none" ? null : supplierId,
          due_date: dueDate || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`Piloto ${code} solicitado (rodada ${round}).`);
      qc.invalidateQueries({ queryKey: ["product-pilots", productId] });
      qc.invalidateQueries({ queryKey: ["product-workspace-protos", productId] });
      qc.invalidateQueries({ queryKey: ["pilots"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="size-4 text-primary" /> Solicitar peça piloto — rodada {round}
          </DialogTitle>
          <DialogDescription>
            A peça segue o ciclo Solicitado → Em confecção → Em prova → Aprovado. Reprovada, você
            abre uma nova rodada mantendo o histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pilot-code">Código do piloto</Label>
            <Input id="pilot-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fornecedor / facção</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Interno / a definir</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pilot-due">Prazo de entrega</Label>
              <Input
                id="pilot-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pilot-notes">Instruções para a piloto</Label>
            <Textarea
              id="pilot-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: conferir caimento do decote e comprimento da manga na base tamanho M."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !code.trim() || !user}
          >
            Solicitar piloto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
