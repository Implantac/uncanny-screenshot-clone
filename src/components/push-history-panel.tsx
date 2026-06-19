import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getRecentPushes } from "@/lib/push-notifications.functions";

const SEV: Record<string, string> = {
  critica: "bg-red-500/15 text-red-400 border-red-500/30",
  alta: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  media: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  baixa: "bg-muted text-muted-foreground",
};

export function PushHistoryPanel() {
  const fn = useServerFn(getRecentPushes);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["push-notifications-recent"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest">Push recentes</h3>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </div>

      {isLoading ? (
        <div className="h-20 bg-muted/30 rounded animate-pulse" />
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          Nenhum push enviado ainda. Use o sininho na Torre de Controle.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((p) => (
            <li key={p.id} className="py-2 flex items-start gap-3">
              <div className="pt-0.5">
                {p.error ? (
                  <AlertTriangle className="size-4 text-amber-400" />
                ) : p.delivered_at ? (
                  <CheckCircle2 className="size-4 text-emerald-400" />
                ) : (
                  <Bell className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${SEV[p.severity] ?? ""}`}>
                    {p.severity}
                  </Badge>
                  <span className="text-sm font-medium truncate">{p.title}</span>
                </div>
                {p.body && (
                  <div className="text-xs text-muted-foreground truncate">{p.body}</div>
                )}
                {p.error && (
                  <div className="text-[11px] text-amber-400 mt-0.5">{p.error}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {new Date(p.sent_at).toLocaleString("pt-BR")}
                </div>
              </div>
              {p.link && (
                <Link
                  to={p.link}
                  className="shrink-0 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Abrir <ExternalLink className="size-3" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
