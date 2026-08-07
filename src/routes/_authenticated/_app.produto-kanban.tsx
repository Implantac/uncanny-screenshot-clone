import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AlertTriangle, ChevronRight, Clock, Download, Search, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/page-header";
import { PlmBreadcrumb } from "@/components/ui/plm-breadcrumb";
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


type QuickFilter = "all" | "blocked" | "overdue" | "pinned";
type Scope = "mine" | "all";
type KanbanSearch = { q: string; f: QuickFilter; scope: Scope };

export const Route = createFileRoute("/_authenticated/_app/produto-kanban")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    f:
      s.f === "blocked" || s.f === "overdue" || s.f === "pinned" || s.f === "all"
        ? (s.f as QuickFilter)
        : "all",
    scope: (s.scope === "all" ? "all" : "mine") as Scope,
  }),
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

const EMPTY_HINTS: Record<WorkflowStep, string> = {
  concepcao: "Nenhum produto em concepção. Use ‘N’ para criar um esboço a partir do briefing.",
  modelagem: "Sem produtos em modelagem. Avance um item aprovado na concepção para começar a ficha.",
  engenharia: "Ninguém em engenharia. Finalize a ficha técnica de um produto para trazê-lo aqui.",
  custos: "Sem custos em análise. Fichas prontas caem aqui para bater a margem-alvo.",
  piloto: "Nenhum piloto em andamento. Solicite uma peça piloto a partir da ficha aprovada.",
  aprov_comercial: "Sem produtos aguardando comercial. Aprove pilotos para escalar a decisão.",
  aprov_diretoria: "Sem itens na diretoria. Comercial aprova primeiro, depois cai aqui.",
  liberacao_pcp: "Nada para liberar ao PCP. Aprove na diretoria para gerar OP.",
  producao: "Sem produtos em produção. Ao liberar ao PCP, a OP aparece aqui.",
};

function exportKanbanCsv(
  cols: { step: WorkflowStep; cards: LifecycleKanbanCard[] }[],
) {
  const rows = [
    ["Fase", "SKU", "Produto", "Coleção", "Dias na fase", "SLA", "Status"],
    ...cols.flatMap((col) =>
      col.cards.map((c) => [
        STEP_META[col.step]?.label ?? col.step,
        c.sku,
        c.name,
        c.collection_name ?? "",
        String(c.days_in_step),
        String(SLA_DAYS[col.step]),
        c.blocked
          ? `Bloqueado${c.blocker_reason ? ": " + c.blocker_reason : ""}`
          : c.days_in_step > SLA_DAYS[col.step]
          ? "Atrasado"
          : "Ok",
      ]),
    ),
  ];
  const csv = rows
    .map((r) =>
      r
        .map((v) => `"${String(v).replaceAll('"', '""').replaceAll("\n", " ")}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ciclo-vida-produtos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado");
}



function ProductLifecycleKanban() {
  const fetchKanban = useServerFn(listLifecycleKanban);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = search.q;
  const quick = search.f;
  const scope = search.scope;
  const setQ = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, q: val }), replace: true });
  const setQuick = (val: QuickFilter) =>
    navigate({ search: (prev) => ({ ...prev, f: val }), replace: true });
  const setScope = (val: Scope) =>
    navigate({ search: (prev) => ({ ...prev, scope: val }), replace: true });

  const { data, isLoading, error } = useQuery({
    queryKey: ["product-lifecycle-kanban", scope],
    queryFn: () => fetchKanban({ data: { scope } }),
    staleTime: 30_000,
  });

  const columns = data?.columns ?? [];
  const mineCount = data?.mine_count ?? 0;
  const allCount = data?.all_count ?? 0;

  const pinnedIds = useMemo<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("plm:pinned-products");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(arr);
    } catch {
      return new Set();
    }
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => {
        if (needle) {
          const hit =
            c.name.toLowerCase().includes(needle) ||
            c.sku.toLowerCase().includes(needle) ||
            (c.collection_name?.toLowerCase() ?? "").includes(needle);
          if (!hit) return false;
        }
        if (quick === "blocked" && !c.blocked) return false;
        if (quick === "overdue" && c.days_in_step <= SLA_DAYS[col.step]) return false;
        if (quick === "pinned" && !pinnedIds.has(c.product_id)) return false;
        return true;
      }),
    }));
  }, [columns, q, quick, pinnedIds]);

  const totals = useMemo(() => {
    const total = columns.reduce((sum, c) => sum + c.cards.length, 0);
    const blocked = columns.reduce(
      (sum, c) => sum + c.cards.filter((x) => x.blocked).length,
      0,
    );
    const overdue = columns.reduce(
      (sum, c) => sum + c.cards.filter((x) => x.days_in_step > SLA_DAYS[c.step]).length,
      0,
    );
    return { total, blocked, overdue };
  }, [columns]);

  const showOwnershipBanner = !isLoading && scope === "mine" && mineCount === 0 && allCount > 0;

  const chips: { key: QuickFilter; label: string; count?: number }[] = [
    { key: "all", label: "Todos", count: totals.total },
    { key: "blocked", label: "Bloqueados", count: totals.blocked },
    { key: "overdue", label: "Atrasados", count: totals.overdue },
    { key: "pinned", label: "Fixados", count: pinnedIds.size },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-3">
        <PlmBreadcrumb items={[{ label: "Desenvolvimento" }, { label: "Ciclo de Vida" }]} />
      </div>
      <PageHeader
        className="border-b px-4 py-3"
        title="Ciclo de Vida do Produto"
        description="Onde cada peça está agora — do briefing à produção."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {chips.map((c) => (
                <Button
                  key={c.key}
                  size="sm"
                  variant={quick === c.key ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setQuick(c.key)}
                >
                  {c.label}
                  {typeof c.count === "number" && (
                    <span className="ml-1 opacity-70">{c.count}</span>
                  )}
                </Button>
              ))}
            </div>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" /> {totals.total}
            </Badge>
            {totals.blocked > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {totals.blocked}
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={!filtered.length}
              onClick={() => exportKanbanCsv(filtered)}
              title="Exportar visão atual em CSV"
            >
              <Download className="h-3 w-3" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => {
                navigator.clipboard
                  .writeText(window.location.href)
                  .then(() => toast.success("Link da visão copiado"))
                  .catch(() => toast.error("Não consegui copiar o link"));
              }}
              title="Copiar link desta visão (filtro + busca)"
            >
              <Share2 className="h-3 w-3" /> Compartilhar
            </Button>
          </div>
        }
      />

      {showOwnershipBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                Você ainda não é dono de nenhum produto neste workspace.
              </div>
              <div className="text-xs opacity-80">
                Existem <strong>{allCount.toLocaleString("pt-BR")}</strong> produtos criados por
                outras pessoas da empresa. Veja todos para acompanhar o ciclo de vida completo.
              </div>
            </div>
          </div>
          <Button size="sm" variant="default" onClick={() => setScope("all")}>
            Ver todos do workspace
          </Button>
        </div>
      )}

      {scope === "all" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
          <span>
            Mostrando <strong>{allCount.toLocaleString("pt-BR")}</strong> produtos de todo o
            workspace (você é dono de {mineCount.toLocaleString("pt-BR")}).
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setScope("mine")}
          >
            Ver só os meus
          </Button>
        </div>
      )}




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
  const avgDays = cards.length
    ? Math.round(cards.reduce((s, c) => s + c.days_in_step, 0) / cards.length)
    : 0;
  const oldest = cards.reduce((max, c) => Math.max(max, c.days_in_step), 0);

  return (
    <div className="flex h-full w-72 flex-col rounded-lg border bg-card">
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
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
        {cards.length > 0 && (
          <div
            className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground"
            title={`SLA da fase: ${sla} dias`}
          >
            <span>
              média <span className="font-medium text-foreground">{avgDays}d</span>
            </span>
            <span>
              mais antigo{" "}
              <span
                className={cn(
                  "font-medium",
                  oldest > sla ? "text-destructive" : "text-foreground",
                )}
              >
                {oldest}d
              </span>{" "}
              / SLA {sla}d
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {cards.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground leading-relaxed">
            {EMPTY_HINTS[step]}
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
  const advanceFn = useServerFn(advanceProductWorkflow);
  const qc = useQueryClient();
  const advance = useMutation({
    mutationFn: () => advanceFn({ data: { productId: card.product_id } }),
    onSuccess: (res) => {
      if (res?.advanced) {
        toast.success(
          `Avançou para ${STEP_META[res.to_step as WorkflowStep]?.label ?? res.to_step}`,
        );
        qc.invalidateQueries({ queryKey: ["product-lifecycle-kanban"] });
      } else {
        toast.warning("Não é possível avançar", {
          description: res?.blockers?.join(" · ") || "Complete os requisitos da fase atual.",
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAdvance = !card.blocked && card.current_step !== "producao";

  return (
    <div
      className={cn(
        "group relative rounded-md border bg-background p-2 text-left transition hover:border-primary/60 hover:shadow-sm",
        card.blocked && "border-destructive/50 bg-destructive/5",
      )}
    >
      <Link
        to="/produto/$id"
        params={{ id: card.product_id }}
        className="block"
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
        <div
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
          title={`${card.days_in_step}d de ${sla}d de SLA`}
        >
          <div
            className={cn(
              "h-full transition-all",
              overdue
                ? "bg-destructive"
                : card.days_in_step / sla > 0.7
                ? "bg-amber-500"
                : "bg-emerald-500",
            )}
            style={{
              width: `${Math.min(100, Math.round((card.days_in_step / sla) * 100))}%`,
            }}
          />
        </div>
        {card.blocked && card.blocker_reason && (
          <div className="mt-1 line-clamp-2 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {card.blocker_reason}
          </div>
        )}
      </Link>

      {canAdvance && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute right-1 top-1 h-6 gap-1 px-1.5 text-[10px] opacity-0 shadow-sm transition group-hover:opacity-100"
          disabled={advance.isPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            advance.mutate();
          }}
          title="Avançar fase"
        >
          Avançar <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

