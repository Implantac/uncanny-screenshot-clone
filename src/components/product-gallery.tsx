import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRef, useState } from "react";
import { Images, Upload, Loader2, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

type Item = { name: string; path: string; url: string; isVideo: boolean };

function prefix(userId: string, productId: string) {
  return `${userId}/products/${productId}`;
}

async function loadGallery(userId: string, productId: string): Promise<Item[]> {
  const pfx = prefix(userId, productId);
  const { data, error } = await supabase.storage.from("product-images").list(pfx, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  const files = (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
  const urls = await Promise.all(
    files.map(async (f) => {
      const path = `${pfx}/${f.name}`;
      const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60);
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return {
        name: f.name,
        path,
        url: signed?.signedUrl ?? "",
        isVideo: ["mp4", "mov", "webm", "m4v"].includes(ext),
      };
    }),
  );
  return urls.filter((u) => !!u.url);
}

export function ProductGallery({ productId, canEdit }: { productId: string; canEdit: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["product-gallery", productId, user?.id],
    queryFn: () => loadGallery(user!.id, productId),
    enabled: !!user?.id,
  });

  const delMut = useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.storage.from("product-images").remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPick(files: FileList | null) {
    if (!files || !user?.id) return;
    setUploading(true);
    try {
      const pfx = prefix(user.id, productId);
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${pfx}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
        if (error) throw error;
      }
      toast.success(`${files.length} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Images className="size-4 text-primary" /> Galeria · fotos e vídeos
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Referências, lookbook, vídeos de prova e detalhes. Apenas você vê (privado).
          </div>
        </div>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => onPick(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              Enviar
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
          Nenhum arquivo ainda. {canEdit && "Clique em Enviar para adicionar fotos ou vídeos."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((it) => (
            <div key={it.path} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30">
              {it.isVideo ? (
                <>
                  <video src={it.url} className="size-full object-cover" muted playsInline />
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <Play className="size-7 text-white drop-shadow" />
                  </div>
                </>
              ) : (
                <img src={it.url} alt={it.name} loading="lazy" className="size-full object-cover" />
              )}
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0"
                aria-label="Abrir"
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => delMut.mutate(it.path)}
                  className="absolute top-1.5 right-1.5 size-7 rounded-md bg-background/80 border border-border grid place-items-center opacity-0 group-hover:opacity-100 transition text-destructive"
                  title="Remover"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
