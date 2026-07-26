import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Plus, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

type CollectionColor = {
  id: string;
  collection_id: string;
  name: string;
  hex: string;
  pantone: string | null;
  cmyk: string | null;
  usage_notes: string | null;
  is_primary: boolean;
  sort_order: number;
};

export function CollectionColorPalette({ collectionId }: { collectionId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", hex: "#000000", pantone: "", notes: "" });

  const { data: colors = [], isLoading } = useQuery({
    queryKey: ["collection-colors", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_colors")
        .select("*")
        .eq("collection_id", collectionId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CollectionColor[];
    },
  });

  const addColor = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      if (!form.name.trim() || !/^#[0-9a-fA-F]{6}$/.test(form.hex)) {
        throw new Error("Nome e hex (#RRGGBB) obrigatórios");
      }
      const { error } = await supabase.from("collection_colors").insert({
        collection_id: collectionId,
        owner_id: user.id,
        name: form.name.trim(),
        hex: form.hex.toUpperCase(),
        pantone: form.pantone.trim() || null,
        usage_notes: form.notes.trim() || null,
        sort_order: colors.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cor adicionada à cartela");
      setForm({ name: "", hex: "#000000", pantone: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["collection-colors", collectionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePrimary = useMutation({
    mutationFn: async (c: CollectionColor) => {
      const { error } = await supabase
        .from("collection_colors")
        .update({ is_primary: !c.is_primary })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection-colors", collectionId] }),
  });

  const removeColor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collection_colors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cor removida");
      qc.invalidateQueries({ queryKey: ["collection-colors", collectionId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" /> Cartela oficial da coleção
          <Badge variant="secondary" className="ml-auto">{colors.length} cores</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_1fr_auto] gap-2 items-end p-3 rounded-lg border bg-muted/30">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Terracota SS26" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hex</label>
            <div className="flex gap-1">
              <input
                type="color"
                value={form.hex}
                onChange={(e) => setForm({ ...form, hex: e.target.value })}
                className="h-9 w-9 rounded border cursor-pointer"
              />
              <Input value={form.hex} onChange={(e) => setForm({ ...form, hex: e.target.value })} className="font-mono uppercase" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Pantone</label>
            <Input value={form.pantone} onChange={(e) => setForm({ ...form, pantone: e.target.value })} placeholder="18-1438 TCX" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Uso</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Base, detalhe, silk…" />
          </div>
          <Button onClick={() => addColor.mutate()} disabled={addColor.isPending}>
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : colors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma cor ainda. Comece pela paleta primária da temporada.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {colors.map((c) => (
              <div key={c.id} className="rounded-lg border overflow-hidden group">
                <div className="h-20 w-full relative" style={{ backgroundColor: c.hex }}>
                  {c.is_primary && (
                    <Badge className="absolute top-1 left-1 bg-white/90 text-black text-[10px]">
                      Primária
                    </Badge>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <div className="flex opacity-0 group-hover:opacity-100 transition">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePrimary.mutate(c)} title="Alternar primária">
                        {c.is_primary ? <StarOff className="size-3" /> : <Star className="size-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeColor.mutate(c.id)} title="Remover">
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] font-mono uppercase text-muted-foreground">{c.hex}</p>
                  {c.pantone && <p className="text-[10px] text-muted-foreground">PMS {c.pantone}</p>}
                  {c.usage_notes && <p className="text-[10px] text-muted-foreground truncate">{c.usage_notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
