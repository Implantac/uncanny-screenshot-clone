import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

export function NotificationsBell() {
  const { data } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: inv }, { data: ops }] = await Promise.all([
        supabase.from("inventory_items").select("id, name, balance, minimum, unit"),
        supabase.from("production_orders").select("id, code, due_date, status, progress").neq("status", "concluida").lte("due_date", today),
      ]);
      const critical = (inv ?? []).filter((i) => Number(i.balance ?? 0) <= Number(i.minimum ?? 0));
      return { critical, overdue: ops ?? [] };
    },
  });

  const total = (data?.critical.length ?? 0) + (data?.overdue.length ?? 0);

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
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
