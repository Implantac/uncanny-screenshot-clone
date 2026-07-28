import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StickyNote, Loader2, Pin, PinOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type DesignerNoteRow = {
  content: string | null;
  pinned: boolean | null;
};

/**
 * DesignerNotes — Post-it persistente no workspace do produto.
 */
export function DesignerNotes({ productId }: { productId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Carregar nota existente
  useEffect(() => {
    if (!user?.id || !productId || loaded) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("designer_notes")
        .select("content, pinned")
        .eq("product_id", productId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        setNote((data as DesignerNoteRow).content ?? "");
        setPinned((data as DesignerNoteRow).pinned ?? false);
      }
      setLoaded(true);
      setLoading(false);
    })();
  }, [productId, user?.id, loaded]);

  // Auto-save com debounce
  const saveMut = useMutation({
    mutationFn: async ({ content, isPinned }: { content: string; isPinned: boolean }) => {
      if (!user?.id) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).from("designer_notes").upsert(
        {
          product_id: productId,
          owner_id: user.id,
          content,
          pinned: isPinned,
        },
        { onConflict: "product_id, owner_id" },
      );
      if (error) throw error;
    },
    onError: () => toast.error("Erro ao salvar anotação"),
  });

  function handleChange(value: string) {
    setNote(value);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveMut.mutate({ content: value, isPinned: pinned });
    }, 1200);
  }

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    saveMut.mutate({ content: note, isPinned: next });
    toast.success(next ? "Anotação fixada" : "Anotação desafixada");
  }

  if (loading) return null;

  return (
    <div
      className={`rounded-xl border transition-all ${
        pinned
          ? "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote
            className={`size-4 shrink-0 ${
              pinned ? "text-amber-500" : "text-muted-foreground"
            }`}
          />
          <span className="text-xs font-medium truncate">
            Notas do Designer
          </span>
          {note && (
            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
              · {note.slice(0, 40)}{note.length > 40 ? "…" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePin();
            }}
            className="size-6 grid place-items-center rounded hover:bg-muted transition-colors"
            title={pinned ? "Desafixar" : "Fixar no topo"}
          >
            {pinned ? (
              <PinOff className="size-3 text-amber-500" />
            ) : (
              <Pin className="size-3 text-muted-foreground" />
            )}
          </button>
          <span className="text-[10px] text-muted-foreground">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <Textarea
            value={note}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Anotações livres do designer — alterações de fitting, observações de modelagem, lembretes para engenharia…"
            rows={3}
            className="text-xs resize-none border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {note.length} caracteres
            </span>
            {saveMut.isPending && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Loader2 className="size-2.5 animate-spin" /> salvando…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

