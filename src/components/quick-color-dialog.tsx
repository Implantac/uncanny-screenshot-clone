import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette, Loader2, Plus } from "lucide-react";

export type QuickColorResult = {
  id: string;
  name: string;
  hex: string;
};

type QuickColorDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Coleção alvo (opcional — se informada, cria na collection_colors) */
  collectionId?: string;
  /** Produto alvo (opcional — se informada, cria na product_color_options) */
  productId?: string;
  /** Callback após criar cor com sucesso */
  onCreated?: (color: QuickColorResult) => void;
  /** Chaves de query para invalidar após criação */
  invalidateKeys?: readonly (readonly unknown[])[];
};

/**
 * QuickColorDialog — Dialog minimalista para adicionar cor à paleta inline,
 * sem precisar navegar para a página de coleção ou produto.
 * 
 * Cria na tabela `collection_colors` se `collectionId` for informado,
 * ou em `product_color_options` se `productId` for informado.
 */
export function QuickColorDialog({
  open,
  onOpenChange,
  collectionId,
  productId,
  onCreated,
  invalidateKeys = [["collection-colors"], ["product-color-options"]],
}: QuickColorDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#CC6633");
  const [pantone, setPantone] = useState("");
  const [notes, setNotes] = useState("");

  const isCollection = !!collectionId;
  const isProduct = !!productId;

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      if (!name.trim()) throw new Error("Informe o nome da cor");
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("Hex inválido (use #RRGGBB)");

      if (isCollection && collectionId) {
        // Criar na collection_colors
        const { data, error } = await supabase
          .from("collection_colors")
          .insert({
            collection_id: collectionId,
            owner_id: user.id,
            name: name.trim(),
            hex: hex.toUpperCase(),
            pantone: pantone.trim() || null,
            usage_notes: notes.trim() || null,
            sort_order: 0,
          })
          .select("id, name, hex")
          .single();
        if (error) throw error;
        return data as QuickColorResult;
      }

      if (isProduct && productId) {
        // Criar na product_color_options
        const { data, error } = await supabase
          .from("product_color_options")
          .insert({
            product_id: productId,
            owner_id: user.id,
            name: name.trim(),
            hex: hex.toUpperCase(),
            position: 0,
            active: true,
          })
          .select("id, name, hex")
          .single();
        if (error) throw error;
        return data as QuickColorResult;
      }

      throw new Error("Informe collectionId ou productId para vincular a cor");
    },
    onSuccess: (data) => {
      toast.success(`Cor "${data.name}" adicionada!`);
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k as unknown[] }));
      onCreated?.(data);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setName("");
    setHex("#CC6633");
    setPantone("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Palette className="size-5" />
            </div>
            <div>
              <DialogTitle>Nova Cor</DialogTitle>
              <DialogDescription>
                {isCollection
                  ? "Adicionar cor à cartela da coleção."
                  : isProduct
                    ? "Adicionar variação de cor ao produto."
                    : "Cadastro rápido de cor."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qc-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Terracota SS26"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-hex">
              Hex <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="size-9 rounded-md border border-input bg-background cursor-pointer shrink-0"
              />
              <Input
                id="qc-hex"
                value={hex}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith("#") || v === "") setHex(v);
                  else setHex("#" + v);
                }}
                placeholder="#CC6633"
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-pantone">Pantone (opcional)</Label>
            <Input
              id="qc-pantone"
              value={pantone}
              onChange={(e) => setPantone(e.target.value)}
              placeholder="Ex.: 18-1438 TCX"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-notes">Observações (opcional)</Label>
            <textarea
              id="qc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Base, detalhe, silk…"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border p-2 flex items-center gap-3">
            <div
              className="size-10 rounded-md shrink-0 border border-border/60"
              style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#cccccc" }}
            />
            <div>
              <div className="text-sm font-medium">{name || "Nome da cor"}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {/^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : "#CC6633"}
                {pantone && ` · PMS ${pantone}`}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || !/^#[0-9a-f]{6}$/.test(hex) || createMut.isPending}
          >
            {createMut.isPending ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> Salvando…</>
            ) : (
              <><Plus className="size-4 mr-1.5" /> Adicionar Cor</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
