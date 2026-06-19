import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageSquare,
  Megaphone,
  Pause,
  Sparkles,
  Check,
  BellOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useRealtime } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { show as showSection, CAT_LABEL, type Cat } from "./notifications-filter";

type Dismissal = { alert_key: string; dismissed_until: string | null; resolved: boolean };

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id ?? null],
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      // widest cutoff (1d) then refine per stage SLA client-side
      const stuckCutoff = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
      const oldProtoCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [
        { data: inv },
        { data: ops },
        { data: stuckOps },
        { data: oldProtos },
        { data: pComments },
        { data: poComments },
        { data: mkt },
        { data: stages },
        { data: dism },
      ] = await Promise.all([
        supabase.from("inventory_items").select("id, name, balance, minimum, unit"),
        supabase
          .from("production_orders")
          .select("id, code, due_date, status, progress")
          .neq("status", "concluida")
          .lte("due_date", today),
        supabase
          .from("production_orders")
          .select("id, code, stage, stage_updated_at")
          .neq("status", "concluida")
          .neq("stage", "entregue")
          .lt("stage_updated_at", stuckCutoff)
          .order("stage_updated_at", { ascending: true })
          .limit(30),
        supabase
          .from("prototypes")
          .select("id, code, name, stage, updated_at")
          .not("stage", "in", "(aprovado,reprovado)")
          .lt("updated_at", oldProtoCutoff)
          .order("updated_at", { ascending: true })
          .limit(8),
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
        supabase
          .from("marketing_notifications")
          .select("id, kind, title, body, link, created_at, read_at")
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("pcp_stages").select("key, sla_stuck_days"),
        user?.id
          ? supabase
              .from("alert_dismissals")
              .select("alert_key, dismissed_until, resolved")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [] as Dismissal[] }),
      ]);
      const slaByStage = new Map<string, number>(
        (stages ?? []).map((s: any) => [s.key, Number(s.sla_stuck_days ?? 3)]),
      );
      const stuckFiltered = (stuckOps ?? [])
        .filter((o: any) => {
          const days = (Date.now() - new Date(o.stage_updated_at).getTime()) / 86_400_000;
          return days >= (slaByStage.get(o.stage) ?? 3);
        })
        .slice(0, 8);
      const critical = (inv ?? []).filter((i) => Number(i.balance ?? 0) <= Number(i.minimum ?? 0));
      const comments = [
        ...((pComments ?? []) as any[])
          .filter((c) => c.author_id !== user?.id)
          .map((c) => ({
            kind: "proto" as const,
            id: c.id,
            refCode: c.prototypes?.code ?? "",
            body: c.body,
            when: c.created_at,
          })),
        ...((poComments ?? []) as any[])
          .filter((c) => c.author_id !== user?.id)
          .map((c) => ({
            kind: "op" as const,
            id: c.id,
            refCode: c.production_orders?.code ?? "",
            body: c.body,
            when: c.created_at,
          })),
      ]
        .sort((a, b) => b.when.localeCompare(a.when))
        .slice(0, 8);
      const dismissals = new Map<string, Dismissal>(
        ((dism ?? []) as Dismissal[]).map((d) => [d.alert_key, d]),
      );
      const isHidden = (key: string) => {
        const d = dismissals.get(key);
        if (!d) return false;
        if (d.resolved) return true;
        if (d.dismissed_until && new Date(d.dismissed_until).getTime() > Date.now()) return true;
        return false;
      };
      return {
        critical: critical.filter((i) => !isHidden(`inv:${i.id}`)),
        overdue: (ops ?? []).filter((o) => !isHidden(`op-overdue:${o.id}`)),
        stuck: stuckFiltered.filter((o: any) => !isHidden(`op-stuck:${o.id}`)),
        oldProtos: (oldProtos ?? []).filter((p: any) => !isHidden(`proto-stale:${p.id}`)),
        comments: comments.filter((c) => !isHidden(`comment:${c.id}`)),
        marketing: ((mkt ?? []) as any[]).filter((m) => !isHidden(`mkt:${m.id}`)),
      };
    },
  });
  useRealtime("inventory_items", ["notifications"]);
  useRealtime("production_orders", ["notifications"]);
  useRealtime("prototype_comments", ["notifications"]);
  useRealtime("production_order_comments", ["notifications"]);
  useRealtime("marketing_notifications", ["notifications"]);
  useRealtime("alert_dismissals", ["notifications"]);

  const markRead = async (id: string) => {
    await supabase
      .from("marketing_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const dismiss = useMutation({
    mutationFn: async ({ key, mode }: { key: string; mode: "snooze" | "resolve" }) => {
      if (!user?.id) return;
      const payload = {
        user_id: user.id,
        owner_id: user.id,
        alert_key: key,
        resolved: mode === "resolve",
        dismissed_until:
          mode === "snooze" ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null,
      };
      await supabase.from("alert_dismissals").upsert(payload, { onConflict: "user_id,alert_key" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const total =
    (data?.critical.length ?? 0) +
    (data?.overdue.length ?? 0) +
    (data?.stuck.length ?? 0) +
    (data?.oldProtos.length ?? 0) +
    (data?.comments.length ?? 0) +
    (data?.marketing.length ?? 0);

  const [cat, setCat] = useState<Cat>("all");
  const counts: Record<Cat, number> = {
    all: total,
    estoque: data?.critical.length ?? 0,
    atraso: data?.overdue.length ?? 0,
    parado: data?.stuck.length ?? 0,
    proto: data?.oldProtos.length ?? 0,
    comentario: data?.comments.length ?? 0,
    marketing: data?.marketing.length ?? 0,
  };
  const show = (k: Exclude<Cat, "all">) => showSection(cat, k);

  const Actions = ({ alertKey }: { alertKey: string }) => (
    <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        title="Adiar 1 dia"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dismiss.mutate({ key: alertKey, mode: "snooze" });
        }}
        className="size-6 grid place-items-center rounded hover:bg-background"
      >
        <BellOff className="size-3 text-muted-foreground" />
      </button>
      <button
        type="button"
        title="Marcar como resolvido"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dismiss.mutate({ key: alertKey, mode: "resolve" });
        }}
        className="size-6 grid place-items-center rounded hover:bg-background"
      >
        <Check className="size-3 text-success" />
      </button>
    </div>
  );

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
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">Central de alertas</div>
          <div className="text-xs text-muted-foreground">
            {total} alerta{total === 1 ? "" : "s"} · passe o mouse para adiar/resolver
          </div>
        </div>
        <div className="px-2 py-2 border-b border-border flex flex-wrap gap-1">
          {(Object.keys(CAT_LABEL) as Cat[]).map((k) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                cat === k
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {CAT_LABEL[k]}
              {counts[k] > 0 && <span className="tabular-nums opacity-80">{counts[k]}</span>}
            </button>
          ))}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(cat === "all" ? total === 0 : counts[cat] === 0) && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="size-8 text-success mx-auto mb-2" />
              {cat === "all" ? "Tudo sob controle" : `Sem alertas em ${CAT_LABEL[cat]}`}
            </div>
          )}
          {show("estoque") &&
            data?.critical.map((i) => (
              <div
                key={`inv-${i.id}`}
                className="group flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 items-start"
              >
                <Link to="/almoxarifado" className="flex gap-3 flex-1 min-w-0">
                  <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Estoque {Number(i.balance)} {i.unit} · mín {Number(i.minimum)}
                    </div>
                  </div>
                </Link>
                <Actions alertKey={`inv:${i.id}`} />
              </div>
            ))}
          {show("marketing") &&
            data?.marketing.map((m) => (
              <div
                key={`mkt-${m.id}`}
                className="group flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 items-start"
              >
                <Link
                  to={m.link || "/marketing"}
                  onClick={() => markRead(m.id)}
                  className="flex gap-3 flex-1 min-w-0"
                >
                  <Megaphone className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    {m.body && (
                      <div className="text-xs text-muted-foreground truncate">{m.body}</div>
                    )}
                  </div>
                </Link>
                <Actions alertKey={`mkt:${m.id}`} />
              </div>
            ))}
          {show("atraso") &&
            data?.overdue.map((o) => (
              <div
                key={`op-${o.id}`}
                className="group flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 items-start"
              >
                <Link to="/pcp" className="flex gap-3 flex-1 min-w-0">
                  <Clock className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">OP {o.code} atrasada</div>
                    <div className="text-xs text-muted-foreground">
                      Prazo {o.due_date} · {o.progress ?? 0}%
                    </div>
                  </div>
                </Link>
                <Actions alertKey={`op-overdue:${o.id}`} />
              </div>
            ))}
          {show("parado") &&
            data?.stuck.map((o: any) => {
              const days = Math.floor(
                (Date.now() - new Date(o.stage_updated_at).getTime()) / 86_400_000,
              );
              return (
                <div
                  key={`stuck-${o.id}`}
                  className="group flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 items-start"
                >
                  <Link to="/pcp-kanban" className="flex gap-3 flex-1 min-w-0">
                    <Pause className="size-4 text-warning shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        OP {o.code} parada em {o.stage}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Sem movimento há {days} dia{days === 1 ? "" : "s"}
                      </div>
                    </div>
                  </Link>
                  <Actions alertKey={`op-stuck:${o.id}`} />
                </div>
              );
            })}
          {show("proto") &&
            data?.oldProtos.map((p: any) => {
              const days = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / 86_400_000);
              return (
                <div
                  key={`proto-${p.id}`}
                  className="group flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 items-start"
                >
                  <Link to="/prototipos" className="flex gap-3 flex-1 min-w-0">
                    <Sparkles className="size-4 text-warning shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        Protótipo {p.code} sem evolução
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.name} · {p.stage} há {days} dias
                      </div>
                    </div>
                  </Link>
                  <Actions alertKey={`proto-stale:${p.id}`} />
                </div>
              );
            })}
          {show("comentario") &&
            data?.comments.map((c) => (
              <div
                key={`cm-${c.id}`}
                className="group flex gap-3 px-4 py-3 hover:bg-muted border-b border-border last:border-0 items-start"
              >
                <Link
                  to={c.kind === "proto" ? "/prototipos" : "/pcp-kanban"}
                  className="flex gap-3 flex-1 min-w-0"
                >
                  <MessageSquare className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {c.kind === "proto" ? "Protótipo" : "OP"} {c.refCode} · novo comentário
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.body}</div>
                  </div>
                </Link>
                <Actions alertKey={`comment:${c.id}`} />
              </div>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
