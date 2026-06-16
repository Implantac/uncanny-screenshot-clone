import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useRealtime } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/use-auth";

export function NotificationsBell() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id ?? null],
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ data: inv }, { data: ops }, { data: pComments }, { data: poComments }] = await Promise.all([
        supabase.from("inventory_items").select("id, name, balance, minimum, unit"),
        supabase.from("production_orders").select("id, code, due_date, status, progress").neq("status", "concluida").lte("due_date", today),
        supabase
          .from("prototype_comments")
          .select("id, prototype_id, body, created_at, author_id, prototypes(code)")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("production_order_comments")
          .select("id, production_order_id, body, created_at, author_id, production_orders(code)")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      const critical = (inv ?? []).filter((i) => Number(i.balance ?? 0) <= Number(i.minimum ?? 0));
      const comments = [
        ...((pComments ?? []) as any[])
          .filter((c) => c.author_id !== user?.id)
          .map((c) => ({ kind: "proto" as const, id: c.id, refCode: c.prototypes?.code ?? "", body: c.body, when: c.created_at })),
        ...((poComments ?? []) as any[])
          .filter((c) => c.author_id !== user?.id)
          .map((c) => ({ kind: "op" as const, id: c.id, refCode: c.production_orders?.code ?? "", body: c.body, when: c.created_at })),
      ].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8);
      return { critical, overdue: ops ?? [], comments };
    },
  });
  useRealtime("inventory_items", ["notifications"]);
  useRealtime("production_orders", ["notifications"]);
  useRealtime("prototype_comments", ["notifications"]);
  useRealtime("production_order_comments", ["notifications"]);

  const total = (data?.critical.length ?? 0) + (data?.overdue.length ?? 0) + (data?.comments.length ?? 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="size-4" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold grid place-items-center">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">Notificações</div>
          <div className="text-xs text-muted-foreground">{total} alerta{total === 1 ? "" : "s"}</div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {total === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="size-8 text-success mx-auto mb-2" />
              Tudo sob controle
            </div>
          )}
          {data?.critical.map((i) => (
            <Link key={`inv-${i.id}`} to="/almoxarifado" className="flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0">
              <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{i.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">Estoque {Number(i.balance)} {i.unit} · mín {Number(i.minimum)}</div>
              </div>
            </Link>
          ))}
          {data?.overdue.map((o) => (
            <Link key={`op-${o.id}`} to="/pcp" className="flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0">
              <Clock className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">OP {o.code} atrasada</div>
                <div className="text-xs text-muted-foreground">Prazo {o.due_date} · {o.progress ?? 0}%</div>
              </div>
            </Link>
          ))}
          {data?.comments.map((c) => (
            <Link
              key={`cm-${c.id}`}
              to={c.kind === "proto" ? "/prototipos" : "/pcp-kanban"}
              className="flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0"
            >
              <MessageSquare className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {c.kind === "proto" ? "Protótipo" : "OP"} {c.refCode} · novo comentário
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.body}</div>
              </div>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
