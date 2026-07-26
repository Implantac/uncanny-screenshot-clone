import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  moodItem: { id: string; image_url: string; caption: string | null; kind: string | null };
};

function slugSku(caption: string | null) {
  const base = (caption ?? "REF").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const clean = base.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12);
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${clean || "REF"}-${stamp}`;
}

export function MoodboardToProductDialog({ open, onOpenChange, collectionId, moodItem }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(moodItem.caption ?? "Novo produto");
  const [sku, setSku] = useState(slugSku(moodItem.caption));
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(
    `Origem: moodboard${moodItem.kind ? ` (${moodItem.kind})` : ""}. ${moodItem.caption ?? ""}`.trim(),
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!name.trim() || !sku.trim()) throw new Error("Nome e SKU são obrigatórios");
      const { data, error } = await supabase
        .from("products")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category: category.trim() || null,
          description: description.trim() || null,
          collection_id: collectionId,
          image_url: moodItem.image_url,
          status: "rascunho",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Produto criado a partir da referência", {
        action: {
          label: "Abrir produto",
          onClick: () => window.location.assign(`/produto/${id}`),
        },
      });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["collection", collectionId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" /> Virar em produto
          </DialogTitle>
          <DialogDescription>
            Cria um rascunho de produto já vinculado à coleção, com a imagem da referência.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[120px_1fr] gap-4">
          <img
            src={moodItem.image_url}
            alt={moodItem.caption ?? "Referência"}
            className="size-full aspect-square object-cover rounded-lg border border-border"
          />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">SKU</label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Vestido"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3" /> Briefing inicial
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Criando…" : "Criar produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
