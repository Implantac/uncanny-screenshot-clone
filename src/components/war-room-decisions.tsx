import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, CheckCircle2, ClipboardList, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "decisao" | "acao" | "risco";

const META: Record<Kind, { label: string; prefix: string; cls: string; Icon: typeof ShieldAlert }> = {
  decisao: {
    label: "Decisão",
    prefix: "🟢 DECISÃO:",
    cls: "bg-success/15 text-success border-success/30",
    Icon: CheckCircle2,
  },
  acao: {
    label: "Ação",
    prefix: "🟡 AÇÃO:",
    cls: "bg-warning/15 text-warning border-warning/30",
    Icon: ClipboardList,
  },
  risco: {
    label: "Risco",
    prefix: "🔴 RISCO:",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
    Icon: AlertTriangle,
  },
};

type Row = {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
  user_id: string;
};

function detectKind(body: string): Kind {
  for (const k of Object.keys(META) as Kind[]) {
    if (body.startsWith(META[k].prefix)) return k;
  }
  return "decisao";
}
function stripPrefix(body: string, kind: Kind) {
  return body.startsWith(META[kind].prefix) ? body.slice(META[kind].prefix.length).trim() : body;
}

export function WarRoomDecisions({ collectionId }: { collectionId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("decisao");
  const [text, setText] = useState("");

  useRealtime("sector_messages", ["war-room-decisions", collectionId]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["war-room-decisions", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sector_messages")
        .select("id, body, author_name, created_at, user_id")
        .eq("ref_kind", "war_room_collection")
        .eq("ref_id", collectionId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) throw new Error("Mensagem vazia");
      const body = `${META[kind].prefix} ${text.trim()}`;
      const { error } = await supabase.from("sector_messages").insert({
        owner_id: user.id,
        user_id: user.id,
        author_name: user.user_metadata?.full_name ?? user.email ?? "Você",
        sector: "desenvolvimento",
        body,
        ref_kind: "war_room_collection",
        ref_id: collectionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["war-room-decisions", collectionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sector_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["war-room-decisions", collectionId] }),
  });

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="size-4 text-primary" />
        <div className="text-sm font-semibold">Decisões, ações & riscos</div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {rows.length} {rows.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div className="flex gap-1.5 mb-2">
        {(Object.keys(META) as Kind[]).map((k) => {
          const M = META[k];
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`text-xs px-2.5 py-1 rounded-md border inline-flex items-center gap-1 transition-colors ${
                active ? M.cls : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <M.Icon className="size-3" /> {M.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add.mutate();
            }
          }}
          placeholder={`Registrar ${META[kind].label.toLowerCase()}… (Enter)`}
          className="h-9"
        />
        <Button size="sm" disabled={add.isPending || !text.trim()} onClick={() => add.mutate()}>
          <Send className="size-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nada registrado ainda. Use os botões acima para abrir a ATA da coleção.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {rows.map((r) => {
            const k = detectKind(r.body);
            const M = META[k];
            const text = stripPrefix(r.body, k);
            const mine = user?.id === r.user_id;
            return (
              <li
                key={r.id}
                className="text-sm border border-border rounded-md p-2 flex items-start gap-2"
              >
                <Badge className={`shrink-0 ${M.cls} border`}>{M.label}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="break-words">{text}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {r.author_name ?? "—"} ·{" "}
                    {new Date(r.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {mine && (
                  <button
                    onClick={() => del.mutate(r.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Remover"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
