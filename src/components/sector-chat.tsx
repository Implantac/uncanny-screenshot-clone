import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSectors } from "@/hooks/use-sectors";
import { useRealtime } from "@/hooks/use-realtime";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MessageCircle, Send, Hash } from "lucide-react";
import { APP_SECTORS, type AppSector } from "@/lib/modules";
import { toast } from "sonner";

const LABEL: Record<AppSector, string> = {
  marketing: "Marketing",
  pcp: "PCP / Produção",
  desenvolvimento: "Desenvolvimento",
};

type Msg = {
  id: string;
  user_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
  sector: AppSector;
};

export function SectorChatButton() {
  const { user } = useAuth();
  const { sectors, isAdmin } = useSectors();
  const available = isAdmin ? APP_SECTORS : sectors;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<AppSector | null>(null);

  useEffect(() => {
    if (open && !active) setActive("marketing");
  }, [open, active]);

  if (!user || available.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          title="Chat dos setores"
          className="size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="size-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4 text-primary" /> Chat dos setores
          </SheetTitle>
          <SheetDescription className="text-xs">
            Comunidade interna. Todos veem as mensagens relacionadas ao
            desenvolvimento/marketing/PCP.
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-1 px-3 pb-2 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActive("marketing")}
            className={`text-xs px-2.5 py-1 rounded-md inline-flex items-center gap-1 whitespace-nowrap ${"bg-primary text-primary-foreground"}`}
          >
            <Hash className="size-3" /> Comunidade (todos)
          </button>
        </div>

        {active && <ChannelView sector={active} />}
      </SheetContent>
    </Sheet>
  );
}

function ChannelView({ sector }: { sector: AppSector }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  useRealtime("sector_messages", ["sector-messages", "community"]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["sector-messages", "community"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sector_messages")
        .select("id, user_id, author_name, body, created_at, sector")
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !user) return;
      const authorName =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Usuário";
      const { error } = await supabase.from("sector_messages").insert({
        owner_id: user.id,
        user_id: user.id,
        author_name: authorName,
        sector,
        body: trimmed,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["sector-messages", sector] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const grouped = useMemo(() => {
    const out: { date: string; items: Msg[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.created_at).toLocaleDateString("pt-BR");
      const last = out[out.length - 1];
      if (last?.date === d) last.items.push(m);
      else out.push({ date: d, items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Carregando…</div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-12 border border-dashed border-border rounded-lg">
            Sem mensagens ainda na comunidade. Seja o primeiro a escrever.
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.date} className="space-y-2">
              <div className="text-[10px] text-center text-muted-foreground">{g.date}</div>
              {g.items.map((m) => {
                const mine = m.user_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {!mine && (
                        <div className="text-[10px] font-medium opacity-80 mb-0.5">
                          {m.author_name ?? "Usuário"}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap wrap-break-word">{m.body}</div>
                      <div
                        className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}
                      >
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate(text);
        }}
        className="border-t border-border p-2 flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem para a comunidade"
          className="flex-1 bg-muted/40 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
        />

        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="size-9 grid place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          title="Enviar"
        >
          <Send className="size-4" />
        </button>
      </form>
    </>
  );
}
