import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type CollectionRef = { id: string; name: string; season: string; year: number };

export function ProductQuickCreateDialog({
  open,
  onOpenChange,
  userId,
  collections,
  defaultCollectionId,
  onAdvanced,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: string;
  collections: CollectionRef[];
  defaultCollectionId?: string | null;
  /** Called when user clicks "Detalhes completos" instead of quick-create */
  onAdvanced?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuTouched, setSkuTouched] = useState(false);
  const [collectionId, setCollectionId] = useState<string>("none");

  // Suggest SKU: first 3 letters of name + timestamp suffix
  const suggestedSku = useMemo(() => {
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    if (!base) return "";
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    return `${base}-${suffix}`;
  }, [name]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSku("");
    setSkuTouched(false);
    setCollectionId(defaultCollectionId ?? (collections[0]?.id ?? "none"));
  }, [open, defaultCollectionId, collections]);

  // Pre-flight: check SKU uniqueness on the fly
  const finalSku = skuTouched && sku ? sku.trim().toUpperCase() : suggestedSku;
  const skuCheck = useQuery({
    enabled: open && !!finalSku && !!userId,
    queryKey: ["quick-sku-check", finalSku, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id")
        .eq("owner_id", userId!)
        .eq("sku", finalSku)
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      if (!name.trim()) throw new Error("Informe o nome do produto");
      if (collectionId === "none") throw new Error("Selecione uma coleção");
      const payload = {
        sku: finalSku,
        name: name.trim(),
        status: "rascunho" as const,
        collection_id: collectionId,
        cost_price: 0,
        sell_price: 0,
        sizes: [],
        colors: [],
        owner_id: userId,
      };
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto criado — vamos completar os detalhes");
      onOpenChange(false);
      navigate({ to: "/produto/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skuTaken = skuCheck.data === true;
  const canSubmit =
    !!name.trim() && collectionId !== "none" && !!finalSku && !skuTaken && !createMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Novo produto
          </DialogTitle>
          <DialogDescription>
            Só o essencial para começar. Você completa ficha, cores e preços dentro do produto.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) createMut.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="qc-name">Nome do produto</Label>
            <Input
              id="qc-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Vestido Florença midi"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-coll">
              Coleção <span className="text-destructive">*</span>
            </Label>
            <Select value={collectionId} onValueChange={setCollectionId}>
              <SelectTrigger id="qc-coll">
                <SelectValue placeholder="Selecione a coleção" />
              </SelectTrigger>
              <SelectContent>
                {collections.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Crie uma coleção primeiro
                  </SelectItem>
                ) : (
                  collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.season} {c.year})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-sku">
              SKU{" "}
              <span className="text-[11px] text-muted-foreground font-normal">
                (deixe vazio para gerar automaticamente)
              </span>
            </Label>
            <Input
              id="qc-sku"
              value={skuTouched ? sku : suggestedSku}
              onChange={(e) => {
                setSkuTouched(true);
                setSku(e.target.value.toUpperCase());
              }}
              placeholder={suggestedSku || "VST-A1B2"}
            />
            {finalSku && skuTaken && (
              <p className="text-xs text-destructive">
                Já existe um produto com este SKU. Ajuste antes de criar.
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {onAdvanced ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onAdvanced();
                }}
              >
                Detalhes completos…
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {createMut.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" /> Criando…
                  </>
                ) : (
                  "Criar e abrir"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
