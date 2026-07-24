import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Bell,
  BellRing,
  Paperclip,
  Send,
  Loader2,
  Trash2,
  Download,
} from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  event_id: string | null;
  event_source: string | null;
};

type Attachment = {
  id: string;
  comment_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
};

const MAX_ATTACH_MB = 15;

export function ProductTimelineCollab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentioned, setMentioned] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const userIdQuery = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 5 * 60_000,
  });
  const userId = userIdQuery.data;

  const peopleQuery = useQuery({
    enabled: mentionQuery !== null,
    queryKey: ["mention-people", mentionQuery],
    queryFn: async () => {
      const q = (mentionQuery ?? "").trim();
      let req = supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name", { ascending: true })
        .limit(8);
      if (q) req = req.ilike("full_name", `%${q}%`);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? [])
        .filter((p) => p.id !== userId && p.full_name)
        .map((p) => ({ id: p.id, name: p.full_name as string }));
    },
    staleTime: 15_000,
  });

  const watcherQuery = useQuery({
    queryKey: ["product-watcher", productId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_watchers")
        .select("id")
        .eq("product_id", productId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const commentsQuery = useQuery({
    queryKey: ["product-timeline-comments", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_timeline_comments")
        .select("id, body, created_at, author_id, event_id, event_source")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    staleTime: 15_000,
  });

  const attachmentsQuery = useQuery({
    queryKey: ["product-timeline-attachments", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_timeline_attachments")
        .select(
          "id, comment_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at",
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Attachment[];
    },
    staleTime: 15_000,
  });

  const attachmentsByComment = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    (attachmentsQuery.data ?? []).forEach((a) => {
      if (!a.comment_id) return;
      const arr = map.get(a.comment_id) ?? [];
      arr.push(a);
      map.set(a.comment_id, arr);
    });
    return map;
  }, [attachmentsQuery.data]);

  const toggleWatch = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sem usuário.");
      if (watcherQuery.data) {
        const { error } = await supabase
          .from("product_watchers")
          .delete()
          .eq("id", watcherQuery.data.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from("product_watchers")
        .insert({ product_id: productId, user_id: userId, owner_id: userId });
      if (error) throw error;
      return true;
    },
    onSuccess: (following) => {
      toast.success(following ? "Você está seguindo este produto" : "Deixou de seguir");
      qc.invalidateQueries({ queryKey: ["product-watcher", productId, userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao alternar"),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sem usuário.");
      const text = body.trim();
      if (!text) throw new Error("Escreva algo primeiro.");

      const { data: c, error } = await supabase
        .from("product_timeline_comments")
        .insert({
          product_id: productId,
          author_id: userId,
          owner_id: userId,
          body: text,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (pendingFiles.length) {
        for (const file of pendingFiles) {
          if (file.size > MAX_ATTACH_MB * 1024 * 1024) {
            toast.error(`Arquivo ${file.name} excede ${MAX_ATTACH_MB}MB`);
            continue;
          }
          const path = `${userId}/${productId}/${crypto.randomUUID()}-${file.name}`;
          const up = await supabase.storage
            .from("product-timeline")
            .upload(path, file, { upsert: false });
          if (up.error) {
            toast.error(`Upload falhou: ${file.name}`);
            continue;
          }
          const { error: aErr } = await supabase
            .from("product_timeline_attachments")
            .insert({
              product_id: productId,
              comment_id: c.id,
              owner_id: userId,
              uploaded_by: userId,
              storage_path: path,
              file_name: file.name,
              mime_type: file.type || null,
              size_bytes: file.size,
            });
          if (aErr) toast.error(`Metadado falhou: ${file.name}`);
        }
      }
      return c.id;
    },
    onSuccess: () => {
      setBody("");
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["product-timeline-comments", productId] });
      qc.invalidateQueries({ queryKey: ["product-timeline-attachments", productId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao comentar"),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_timeline_comments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-timeline-comments", productId] });
      qc.invalidateQueries({ queryKey: ["product-timeline-attachments", productId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  async function downloadAttachment(a: Attachment) {
    const { data, error } = await supabase.storage
      .from("product-timeline")
      .createSignedUrl(a.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const following = !!watcherQuery.data;

  return (
    <div className="mt-4 border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <MessageSquare className="size-3.5 text-primary" /> Discussão do produto
          {commentsQuery.data && (
            <Badge variant="outline" className="font-mono text-[10px] py-0 h-4">
              {commentsQuery.data.length}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={following ? "default" : "outline"}
          className="h-7 text-xs"
          disabled={toggleWatch.isPending || !userId}
          onClick={() => toggleWatch.mutate()}
        >
          {following ? (
            <>
              <BellRing className="size-3 mr-1.5" /> Seguindo
            </>
          ) : (
            <>
              <Bell className="size-3 mr-1.5" /> Seguir
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Comentar, marcar ajuste, registrar decisão…"
          className="text-sm min-h-[64px] bg-background"
        />
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                <Paperclip className="size-3" /> {f.name}
                <button
                  type="button"
                  className="ml-1 opacity-60 hover:opacity-100"
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            <Paperclip className="size-3.5" /> Anexar
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPendingFiles((prev) => [...prev, ...files]);
              }}
            />
          </label>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={addComment.isPending || !body.trim()}
            onClick={() => addComment.mutate()}
          >
            {addComment.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin mr-1.5" /> Enviando…
              </>
            ) : (
              <>
                <Send className="size-3 mr-1.5" /> Publicar
              </>
            )}
          </Button>
        </div>
      </div>

      {commentsQuery.isLoading ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Carregando…
        </div>
      ) : (commentsQuery.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Sem comentários ainda. Seja o primeiro a registrar uma decisão.
        </div>
      ) : (
        <ul className="space-y-2">
          {(commentsQuery.data ?? []).map((c) => {
            const atts = attachmentsByComment.get(c.id) ?? [];
            const mine = c.author_id === userId;
            return (
              <li
                key={c.id}
                className="rounded-lg border border-border bg-card p-2.5 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {c.body}
                  </div>
                  {mine && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      title="Remover"
                      onClick={() => removeComment.mutate(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                {atts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {atts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => downloadAttachment(a)}
                        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-muted hover:bg-muted/70"
                      >
                        <Download className="size-3" />
                        <span className="truncate max-w-[180px]">{a.file_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
