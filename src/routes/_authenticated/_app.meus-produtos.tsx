import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProductsUnread } from "@/hooks/use-my-products-unread";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BellRing,
  Package,
  MessageSquare,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/meus-produtos")({
  head: () => ({
    meta: [
      { title: "Meus Produtos · USE MODA PLM" },
      {
        name: "description",
        content:
          "Feed pessoal com produtos que você segue, aprovações pendentes e conversas recentes.",
      },
    ],
  }),
  component: MyProductsFeed,
});

type WatchedRow = {
  product_id: string;
  created_at: string;
  products: {
    id: string;
    sku: string;
    name: string;
    status: string;
    image_url: string | null;
    updated_at: string;
  } | null;
};

type PendingApproval = {
  id: string;
  product_id: string;
  gate_key: string;
  decision: string;
  created_at: string;
  requested_by: string | null;
  products: { sku: string; name: string } | null;
};

type RecentComment = {
  id: string;
  product_id: string;
  body: string;
  created_at: string;
  author_id: string;
  products: { sku: string; name: string } | null;
};

function MyProductsFeed() {
  const { user } = useAuth();
  const uid = user?.id;

  const watched = useQuery({
    enabled: !!uid,
    queryKey: ["my-products-watched", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_watchers")
        .select(
          "product_id, created_at, products:product_id(id, sku, name, status, image_url, updated_at)",
        )
        .eq("user_id", uid!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WatchedRow[];
    },
  });

  const watchedIds = (watched.data ?? []).map((w) => w.product_id);

  const approvals = useQuery({
    enabled: !!uid,
    queryKey: ["my-products-approvals-pending", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_approvals")
        .select(
          "id, product_id, gate_key, decision, created_at, requested_by, products:product_id(sku, name)",
        )
        .eq("decision", "pendente")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as PendingApproval[];
    },
  });

  const comments = useQuery({
    enabled: !!uid && watchedIds.length > 0,
    queryKey: ["my-products-comments", uid, watchedIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_timeline_comments")
        .select(
          "id, product_id, body, created_at, author_id, products:product_id(sku, name)",
        )
        .in("product_id", watchedIds)
        .neq("author_id", uid!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as RecentComment[];
    },
  });

  const loading = watched.isLoading || approvals.isLoading;

  const unread = useMyProductsUnread();
  const lastSeen = unread.lastSeen;

  const isNew = (iso: string) => iso > lastSeen;

  const newApprovals = (approvals.data ?? []).filter((a) => isNew(a.created_at)).length;
  const newComments = (comments.data ?? []).filter((c) => isNew(c.created_at)).length;

  // Marca como lido ao sair da página
  useEffect(() => {
    return () => {
      unread.markAllRead();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Meus Produtos"
        description="Feed pessoal — produtos que você segue, aprovações pendentes e conversas recentes."
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


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Watched products */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3 lg:col-span-2">
          <header className="flex items-center gap-2">
            <Package className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">
              Produtos que você segue
              <span className="ml-2 text-muted-foreground font-normal">
                ({watched.data?.length ?? 0})
              </span>
            </h2>
          </header>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (watched.data ?? []).length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="Nada por aqui"
              description="Abra um produto e clique em Seguir para acompanhar mudanças aqui."
            />
          ) : (
            <ul className="space-y-1.5">
              {(watched.data ?? []).map((w) => {
                const p = w.products;
                if (!p) return null;
                return (
                  <li key={w.product_id}>
                    <Link
                      to="/produto/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 border border-border rounded-lg px-3 py-2 hover:bg-muted transition"
                    >
                      <div className="size-10 rounded overflow-hidden bg-muted/40 shrink-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="size-full grid place-items-center text-muted-foreground">
                            <Package className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {p.sku}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {p.status}
                      </Badge>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Pending approvals */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <header className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold">
              Aprovações pendentes
              <span className="ml-2 text-muted-foreground font-normal">
                ({approvals.data?.length ?? 0})
              </span>
            </h2>
            {newApprovals > 0 && (
              <Badge className="text-[10px] bg-primary text-primary-foreground">
                {newApprovals} nova{newApprovals === 1 ? "" : "s"}
              </Badge>
            )}
          </header>
          {(approvals.data ?? []).length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Sem pendências"
              description="Nenhum gate esperando decisão."
            />
          ) : (
            <ul className="space-y-1.5">
              {(approvals.data ?? []).map((a) => (
                <li key={a.id}>
                  <Link
                    to="/produto/$id"
                    params={{ id: a.product_id }}
                    className="block border border-border rounded-lg px-3 py-2 hover:bg-muted transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium truncate">
                        {a.products?.name ?? "Produto"}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30"
                      >
                        pendente
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Gate: <span className="font-mono">{a.gate_key}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent comments feed */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <header className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">
            Conversas recentes nos seus produtos
            <span className="ml-2 text-muted-foreground font-normal">
              ({comments.data?.length ?? 0})
            </span>
          </h2>
        </header>
        {watchedIds.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Você ainda não segue nenhum produto"
            description="Ao seguir produtos, os comentários da equipe aparecem aqui."
          />
        ) : (comments.data ?? []).length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Sem novas conversas"
            description="Ninguém comentou nos produtos que você segue ainda."
          />
        ) : (
          <ul className="space-y-2">
            {(comments.data ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  to="/produto/$id"
                  params={{ id: c.product_id }}
                  className="block border border-border rounded-lg px-3 py-2 hover:bg-muted transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-xs font-medium truncate">
                      {c.products?.name ?? "Produto"}
                      <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                        {c.products?.sku}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {c.body}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
