import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ImagePlus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { StorageUploader } from "@/components/storage-uploader";

type MoodKind = "inspiracao" | "tendencia" | "referencia";
const KIND_LABEL: Record<MoodKind, string> = {
  inspiracao: "Inspiração",
  tendencia: "Tendência",
  referencia: "Referência",
};

type MoodItem = {
  id: string;
  image_url: string;
  caption: string | null;
  kind: MoodKind | null;
  position: number | null;
};

export function CollectionMoodboard({ collectionId }: { collectionId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [kind, setKind] = useState<MoodKind>("inspiracao");

  const { data = [] } = useQuery({
    queryKey: ["moodboard", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_moodboard" as never)
        .select("id, image_url, caption, kind, position")
        .eq("collection_id", collectionId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MoodItem[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!url.trim()) throw new Error("Informe a URL da imagem");
      const { error } = await supabase.from("collection_moodboard" as never).insert({
        collection_id: collectionId,
        owner_id: user.id,
        image_url: url.trim(),
        caption: caption.trim() || null,
        kind,
        position: data.length,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moodboard", collectionId] });
      toast.success("Referência adicionada");
      setOpen(false);
      setUrl("");
      setCaption("");
      setKind("inspiracao");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("collection_moodboard" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["moodboard", collectionId] }),
  });

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Moodboard
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Inspirações, tendências e referências visuais da coleção.
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
          Nenhuma referência ainda. Cole uma URL de Pinterest, Behance ou qualquer imagem.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.map((m) => (
            <div
              key={m.id}
              className="group relative rounded-lg overflow-hidden border border-border bg-muted/30 aspect-square"
            >
              <img
                src={m.image_url}
                alt={m.caption ?? "Referência"}
                className="size-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2">
                <div className="flex items-center justify-between gap-1">
                  {m.kind && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {KIND_LABEL[m.kind]}
                    </Badge>
                  )}
                  <button
                    onClick={() => del.mutate(m.id)}
                    className="size-5 rounded bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive"
                    title="Remover"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                {m.caption && (
                  <div className="text-[10px] text-white/90 mt-1 line-clamp-2">{m.caption}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="size-4 text-primary" /> Nova referência
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Imagem</label>
              <StorageUploader
                bucket="collection-covers"
                value={url || null}
                onChange={(u) => setUrl(u ?? "")}
                kind="image"
                label="Enviar imagem"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Legenda (opcional)</label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Tons terrosos · outono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <div className="flex gap-1.5">
                {(Object.keys(KIND_LABEL) as MoodKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex-1 text-xs px-2 py-1.5 rounded border transition ${kind === k ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Salvando…" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
