import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Clock, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductReadinessBadge } from "@/components/product-readiness-badge";
import {
  listLifecycleKanban,
  type LifecycleKanbanCard,
} from "@/lib/product-lifecycle-kanban.functions";
import {
  advanceProductWorkflow,
  STEP_META,
  type WorkflowStep,
} from "@/lib/product-workflow.functions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/_app/produto-kanban")({
  component: ProductLifecycleKanban,
  head: () => ({
    meta: [
      { title: "Kanban do Ciclo de Vida do Produto — USE PLM" },
      {
        name: "description",
        content:
          "Visão de portfólio por fase do ciclo de vida: Concepção → Modelagem → Ficha → Custos → Piloto → Aprovação → PCP → Produção.",
      },
    ],
  }),
});

const SLA_DAYS: Record<WorkflowStep, number> = {
  concepcao: 5,
  modelagem: 7,
  engenharia: 7,
  custos: 5,
  piloto: 10,
  aprov_comercial: 3,
  aprov_diretoria: 3,
  liberacao_pcp: 2,
  producao: 30,
};

function ProductLifecycleKanban() {
  const fetchKanban = useServerFn(listLifecycleKanban);
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["product-lifecycle-kanban"],
    queryFn: () => fetchKanban(),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.map((col) => ({
      ...col,
      cards: col.cards.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.sku.toLowerCase().includes(needle) ||
          (c.collection_name?.toLowerCase() ?? "").includes(needle),
      ),
    }));
  }, [data, q]);

  const totals = useMemo(() => {
    const total = data?.reduce((sum, c) => sum + c.cards.length, 0) ?? 0;
    const blocked =
      data?.reduce((sum, c) => sum + c.cards.filter((x) => x.blocked).length, 0) ?? 0;
    return { total, blocked };
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        className="border-b px-4 py-3"
        title="Ciclo de Vida do Produto"
        description="Onde cada peça está agora — do briefing à produção."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" /> {totals.total} produtos
            </Badge>
            {totals.blocked > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {totals.blocked} bloqueados
              </Badge>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar SKU, produto, coleção…"
                className="h-8 w-56 pl-7 text-sm"
              />
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-3 p-4">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-full w-72 animate-pulse rounded-lg border bg-muted/30"
              />
            ))}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Não consegui carregar o Kanban do ciclo de vida.
            </div>
          )}

          {!isLoading &&
            !error &&
            filtered.map((col) => (
              <LifecycleColumn key={col.step} step={col.step} cards={col.cards} />
            ))}
        </div>
      </div>
    </div>
  );
}

function LifecycleColumn({
  step,
  cards,
}: {
  step: WorkflowStep;
  cards: LifecycleKanbanCard[];
}) {
  const meta = STEP_META[step];
  const sla = SLA_DAYS[step];
  const stale = cards.filter((c) => c.days_in_step > sla).length;

  return (
    <div className="flex h-full w-72 flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{meta.label}</div>
          <div className="text-[11px] text-muted-foreground">{meta.role}</div>
        </div>
        <div className="flex items-center gap-1">
          {stale > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              {stale} atrasadas
            </Badge>
          )}
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {cards.length}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {cards.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum produto nesta fase.
          </div>
        )}
        {cards.map((card) => (
          <LifecycleCard key={card.product_id} card={card} sla={sla} />
        ))}
      </div>
    </div>
  );
}

function LifecycleCard({
  card,
  sla,
}: {
  card: LifecycleKanbanCard;
  sla: number;
}) {
  const overdue = card.days_in_step > sla;
  return (
    <Link
      to="/produto/$id"
      params={{ id: card.product_id }}
      className={cn(
        "block rounded-md border bg-background p-2 text-left transition hover:border-primary/60 hover:shadow-sm",
        card.blocked && "border-destructive/50 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-2">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt=""
            className="h-10 w-10 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
            {card.sku.slice(0, 3)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{card.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {card.sku}
            {card.collection_name ? ` • ${card.collection_name}` : ""}
          </div>
        </div>
        <ProductReadinessBadge productId={card.product_id} className="scale-90" />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            overdue ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <Clock className="h-3 w-3" />
          {card.days_in_step}d na fase
          {overdue && ` • SLA ${sla}d`}
        </span>
        {card.blocked && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" /> bloqueado
          </span>
        )}
      </div>
      {card.blocked && card.blocker_reason && (
        <div className="mt-1 line-clamp-2 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {card.blocker_reason}
        </div>
      )}
    </Link>
  );
}
