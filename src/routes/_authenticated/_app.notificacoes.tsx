import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProductsUnread } from "@/hooks/use-my-products-unread";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import {
  Bell,
  ShieldCheck,
  MessageSquare,
  Clock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const searchSchema = z.object({
  filter: fallback(z.string(), "all").default("all"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/_app/notificacoes")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Notificações · USE MODA PLM" },
      {
        name: "description",
        content:
          "Central de notificações — aprovações pendentes e menções nos seus produtos.",
      },
    ],
  }),
  component: NotificationsPage,
});

type NotifItem = {
  kind: "approval" | "mention";
  id: string;
  product_id: string;
  created_at: string;
  title: string;
  subtitle: string;
  productName: string;
  productSku: string | null;
};

function NotificationsPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const { filter, page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const unread = useMyProductsUnread();
  const filterKey = ["all", "approvals", "mentions"].includes(filter) ? filter : "all";

  const watched = useQuery({
    enabled: !!uid,
    queryKey: ["notif-watched", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_watchers")
        .select("product_id")
        .eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []).map((r) => r.product_id);
    },
  });

  const watchedIds = watched.data ?? [];

  const data = useQuery({
    enabled: !!uid && !watched.isLoading,
    queryKey: ["notif-list", uid, filterKey, watchedIds.join(","), page],
    queryFn: async (): Promise<{ items: NotifItem[]; total: number }> => {
      const items: NotifItem[] = [];
      let total = 0;

      const wantApprovals = filterKey === "all" || filterKey === "approvals";
      const wantMentions =
        (filterKey === "all" || filterKey === "mentions") && watchedIds.length > 0;

      if (wantApprovals) {
        const { count } = await supabase
          .from("product_approvals")
          .select("id", { count: "exact", head: true })
          .eq("decision", "pendente");
        total += count ?? 0;
      }
      if (wantMentions) {
        const { count } = await supabase
          .from("product_timeline_comments")
          .select("id", { count: "exact", head: true })
          .in("product_id", watchedIds)
          .neq("author_id", uid!);
        total += count ?? 0;
      }

      // Naive combined pagination: fetch enough from both, merge, slice.
      const need = page * PAGE_SIZE;

      if (wantApprovals) {
        const { data: rows } = await supabase
          .from("product_approvals")
          .select(
            "id, product_id, gate_key, created_at, products:product_id(sku, name)",
          )
          .eq("decision", "pendente")
          .order("created_at", { ascending: false })
          .limit(need);
        for (const a of (rows ?? []) as Array<{
          id: string;
          product_id: string;
          gate_key: string;
          created_at: string;
          products: { sku: string; name: string } | null;
        }>) {
          items.push({
            kind: "approval",
            id: a.id,
            product_id: a.product_id,
            created_at: a.created_at,
            title: a.products?.name ?? "Produto",
            subtitle: `Gate: ${a.gate_key}`,
            productName: a.products?.name ?? "Produto",
            productSku: a.products?.sku ?? null,
          });
        }
      }

      if (wantMentions) {
        const { data: rows } = await supabase
          .from("product_timeline_comments")
          .select(
            "id, product_id, body, created_at, products:product_id(sku, name)",
          )
          .in("product_id", watchedIds)
          .neq("author_id", uid!)
          .order("created_at", { ascending: false })
          .limit(need);
        for (const c of (rows ?? []) as Array<{
          id: string;
          product_id: string;
          body: string;
          created_at: string;
          products: { sku: string; name: string } | null;
        }>) {
          items.push({
            kind: "mention",
            id: c.id,
            product_id: c.product_id,
            created_at: c.created_at,
            title: c.products?.name ?? "Produto",
            subtitle: c.body,
            productName: c.products?.name ?? "Produto",
            productSku: c.products?.sku ?? null,
          });
        }
      }

      items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const start = (page - 1) * PAGE_SIZE;
      return { items: items.slice(start, start + PAGE_SIZE), total };
    },
  });

  const items = data.data?.items ?? [];
  const total = data.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const lastSeen = unread.lastSeen;

  const setFilter = (f: string) =>
    navigate({ search: { filter: f, page: 1 } });
  const setPage = (p: number) =>
    navigate({ search: (prev: { filter: string; page: number }) => ({ ...prev, page: p }) });

  const FILTERS: Array<{ key: string; label: string; icon: typeof Bell }> = [
    { key: "all", label: "Todas", icon: Bell },
    { key: "approvals", label: "Aprovações", icon: ShieldCheck },
    { key: "mentions", label: "Menções", icon: MessageSquare },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Notificações"
        description="Central de aprovações pendentes e menções nos seus produtos."
        actions={
          unread.total > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => unread.markAllRead()}
              className="gap-1.5"
            >
              <CheckCheck className="size-3.5" />
              Marcar tudo como lido ({unread.total})
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filterKey === f.key;
          const badge =
            f.key === "approvals"
              ? unread.approvals
              : f.key === "mentions"
                ? unread.mentions
                : unread.total;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {f.label}
              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-[18px] px-1 h-[16px] rounded-full text-[10px] grid place-items-center",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto text-xs text-muted-foreground">
          {total} {total === 1 ? "notificação" : "notificações"}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card">
        {data.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Bell}
              title="Sem notificações"
              description={
                filterKey === "mentions"
                  ? "Você não tem menções recentes. Siga produtos para receber comentários da equipe."
                  : "Nada por aqui. Você está em dia."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const fresh = n.created_at > lastSeen;
              const Icon = n.kind === "approval" ? ShieldCheck : MessageSquare;
              return (
                <li key={`${n.kind}-${n.id}`}>
                  <Link
                    to="/produto/$id"
                    params={{ id: n.product_id }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition relative"
                  >
                    {fresh && (
                      <span
                        aria-label="Nova"
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-primary"
                      />
                    )}
                    <div
                      className={cn(
                        "size-8 rounded-md grid place-items-center shrink-0",
                        n.kind === "approval"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">
                          {n.title}
                          {n.productSku && (
                            <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                              {n.productSku}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] shrink-0",
                            n.kind === "approval"
                              ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                              : "bg-primary/10 text-primary border-primary/30",
                          )}
                        >
                          {n.kind === "approval" ? "aprovação" : "menção"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">
                        {n.subtitle}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Página {safePage} de {totalPages}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                className="gap-1"
              >
                <ChevronLeft className="size-3.5" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="gap-1"
              >
                Próxima
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
