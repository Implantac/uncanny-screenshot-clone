import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessageSquare, Wrench, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const STAGE_LABEL: Record<string, string> = {
  cad: "CAD",
  modelagem: "Modelagem",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  concluido: "Concluído",
};

type Event = {
  ts: string;
  kind: "comment" | "adjustment" | "stage";
  title: string;
  body?: string;
  badge?: string;
};

export function PrototypeTimelineButton({
  prototypeId,
  prototypeCode,
}: {
  prototypeId: string;
  prototypeCode: string;
}) {
  const [open, setOpen] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    enabled: open,
    queryKey: ["proto-timeline", prototypeId],
    queryFn: async () => {
      const [cmts, adjs, opR] = await Promise.all([
        supabase
          .from("prototype_comments")
          .select("id, body, created_at")
          .eq("prototype_id", prototypeId)
          .order("created_at", { ascending: false }),
        supabase
          .from("prototype_adjustments")
          .select("id, sector, reason, status, created_at")
          .eq("prototype_id", prototypeId)
          .order("created_at", { ascending: false }),
        supabase.from("production_orders").select("id").ilike("notes", `%[proto:${prototypeId}]%`),
      ]);

      const stageLogs: any[] = [];
      const orderIds = (opR.data ?? []).map((o: any) => o.id);
      if (orderIds.length) {
        const { data } = await supabase
          .from("production_stage_log")
          .select("from_stage, to_stage, quantity, is_partial, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false });
        stageLogs.push(...(data ?? []));
      }

      const ev: Event[] = [
        ...(cmts.data ?? []).map((c: any) => ({
          ts: c.created_at,
          kind: "comment" as const,
          title: "Comentário",
          body: c.body,
        })),
        ...(adjs.data ?? []).map((a: any) => ({
          ts: a.created_at,
          kind: "adjustment" as const,
          title: `Ajuste · ${a.sector ?? "—"}`,
          body: a.reason ?? undefined,
          badge: a.status,
        })),
        ...stageLogs.map((s: any) => ({
          ts: s.created_at,
          kind: "stage" as const,
          title: `Produção: ${s.from_stage ? (STAGE_LABEL[s.from_stage] ?? s.from_stage) : "início"} → ${STAGE_LABEL[s.to_stage] ?? s.to_stage}`,
          body: `${s.quantity} pç${s.is_partial ? " · parcial" : ""}`,
        })),
      ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

      return ev;
    },
  });

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Timeline"
      >
        <History className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" /> Timeline · {prototypeCode}
            </DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento ainda.</p>
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {events.map((e, i) => {
                const Icon =
                  e.kind === "comment"
                    ? MessageSquare
                    : e.kind === "adjustment"
                      ? Wrench
                      : Activity;
                const tone =
                  e.kind === "adjustment"
                    ? "text-amber-500"
                    : e.kind === "stage"
                      ? "text-primary"
                      : "text-muted-foreground";
                return (
                  <li key={i} className="pl-5 relative">
                    <span
                      className={`absolute -left-1.5 top-1.5 size-3 rounded-full bg-background border-2 ${e.kind === "adjustment" ? "border-amber-500" : "border-primary"}`}
                    />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className={`size-3.5 ${tone}`} />
                      <span>{e.title}</span>
                      {e.badge && (
                        <Badge variant="outline" className="text-[9px]">
                          {e.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(e.ts).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                    {e.body && (
                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        {e.body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
