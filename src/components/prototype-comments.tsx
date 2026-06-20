import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Comment = {
  id: string;
  prototype_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PrototypeCommentsButton({
  prototypeId,
  prototypeCode,
}: {
  prototypeId: string;
  prototypeCode: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useQuery({
    queryKey: ["prototype-comments-count", prototypeId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("prototype_comments")
        .select("id", { count: "exact", head: true })
        .eq("prototype_id", prototypeId);
      if (error) throw error;
      return count ?? 0;
    },
  });
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(true)}
        title="Discussão"
        className="relative"
      >
        <MessageSquare className="size-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary text-[9px] font-semibold text-primary-foreground grid place-items-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Discussão ·{" "}
              <span className="font-mono text-xs text-muted-foreground">{prototypeCode}</span>
            </DialogTitle>
          </DialogHeader>
          <CommentsThread prototypeId={prototypeId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommentsThread({ prototypeId }: { prototypeId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["prototype-comments", prototypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prototype_comments")
        .select("*")
        .eq("prototype_id", prototypeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const add = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Não autenticado");
      const { data: proto, error: protoErr } = await supabase
        .from("prototypes")
        .select("owner_id")
        .eq("id", prototypeId)
        .single();
      if (protoErr || !proto) throw new Error("Protótipo não encontrado");
      const { error } = await supabase.from("prototype_comments").insert({
        prototype_id: prototypeId,
        owner_id: proto.owner_id,
        author_id: user.id,
        body: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["prototype-comments", prototypeId] });
      qc.invalidateQueries({ queryKey: ["prototype-comments-count", prototypeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prototype_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototype-comments", prototypeId] });
      qc.invalidateQueries({ queryKey: ["prototype-comments-count", prototypeId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sem comentários ainda — comece a conversa.
          </p>
        ) : (
          items.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-muted/20 p-2.5 text-sm">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span className="font-medium">{c.author_id === user?.id ? "Você" : "Equipe"}</span>
                <span className="flex items-center gap-2">
                  <span>{timeAgo(c.created_at)}</span>
                  {c.author_id === user?.id && (
                    <button
                      onClick={() => del.mutate(c.id)}
                      className="hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </span>
              </div>
              <div className="whitespace-pre-wrap leading-snug">{c.body}</div>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = body.trim();
          if (trimmed) add.mutate(trimmed);
        }}
        className="flex gap-2 items-end"
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário…"
          className="min-h-[60px] resize-none"
        />
        <Button type="submit" size="icon" disabled={!body.trim() || add.isPending}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
