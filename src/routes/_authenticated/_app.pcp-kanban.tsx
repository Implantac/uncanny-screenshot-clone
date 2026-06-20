import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  Factory,
  AlertTriangle,
  Clock,
  Flag,
  ArrowRight,
  History,
  Package,
  X,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { ProductionOrderCommentsButton } from "@/components/production-order-comments";
import { ProductionOccurrenceButton } from "@/components/production-occurrence";
import { QuickPassButton } from "@/components/quick-pass";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";
import { DelayPredictionPanel } from "@/components/delay-prediction-panel";
import { LoteReferencesDrawer } from "@/components/lote-references-drawer";
import { ProductionTechSheetDrawer } from "@/components/production-tech-sheet-drawer";
import { SamEfficiencyPanel } from "@/components/sam-efficiency-panel";
import { LoteSplitDialog } from "@/components/lote-split-dialog";

export const Route = createFileRoute("/_authenticated/_app/pcp-kanban")({ component: PcpKanban });

type Stage = "cad" | "corte" | "costura" | "acabamento" | "qualidade" | "expedicao" | "entregue";
type Order = {
  id: string;
  owner_id: string;
  code: string;
  stage: Stage;
  quantity: number;
  progress: number;
  due_date: string | null;
  priority: number;
  stage_updated_at: string;
  batch_code: string | null;
  product_id: string | null;
  supplier?: string | null;
  product?: string | null;
};

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "cad", label: "CAD / Modelagem", hint: "Ficha técnica & encaixe" },
  { key: "corte", label: "Corte", hint: "Risco e enfesto" },
  { key: "costura", label: "Costura", hint: "Confecção" },
  { key: "acabamento", label: "Acabamento", hint: "Arremate & passadoria" },
  { key: "qualidade", label: "Qualidade", hint: "Inspeção" },
  { key: "expedicao", label: "Expedição", hint: "Embalagem & envio" },
  { key: "entregue", label: "Entregue", hint: "Concluído" },
];

const PRIORITY: Record<number, { label: string; tone: string }> = {
  1: { label: "Urgente", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  2: { label: "Alta", tone: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  3: { label: "Normal", tone: "bg-muted text-muted-foreground border-border" },
  4: { label: "Baixa", tone: "bg-muted text-muted-foreground border-border" },
  5: { label: "Backlog", tone: "bg-muted text-muted-foreground border-border" },
};

async function load(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("production_orders")
    .select(
      "id, owner_id, code, stage, quantity, progress, due_date, priority, stage_updated_at, batch_code, product_id, suppliers(name), products(name)",
    )
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    ...o,
    supplier: o.suppliers?.name ?? null,
    product: o.products?.name ?? null,
  })) as Order[];
}

function daysTo(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function PcpKanban() {
  const qc = useQueryClient();
  useRealtime("production_orders", ["pcp-kanban"]);
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["pcp-kanban"], queryFn: load });

  // Gate de qualidade: OPs com CAPA aberta não podem avançar para Expedição/Entregue.
  const { data: openCapaOrderIds = new Set<string>() } = useQuery({
    queryKey: ["pcp-kanban-open-capa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_capa")
        .select("order_id")
        .eq("status", "aberta")
        .not("order_id", "is", null);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r) => r.order_id as string));
    },
    refetchInterval: 60_000,
  });
  useRealtime("quality_capa", ["pcp-kanban-open-capa"]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [mode, setMode] = useState<"ordens" | "lotes">("ordens");
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [loteDrawer, setLoteDrawer] = useState<string | null>(null);
  const [fichaDrawer, setFichaDrawer] = useState<{
    productId: string;
    orderId: string;
    orderCode: string;
  } | null>(null);

  const update = useMutation({
    mutationFn: async (
      patch: { id: string } & Partial<Pick<Order, "stage" | "priority" | "due_date" | "progress">>,
    ) => {
      const { id, ...changes } = patch;
      const { error } = await supabase.from("production_orders").update(changes).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["pcp-kanban"] });
      const prev = qc.getQueryData<Order[]>(["pcp-kanban"]);
      qc.setQueryData<Order[]>(["pcp-kanban"], (old = []) =>
        old.map((o) =>
          o.id === patch.id
            ? {
                ...o,
                ...patch,
                stage_updated_at: patch.stage ? new Date().toISOString() : o.stage_updated_at,
              }
            : o,
        ),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pcp-kanban"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pcp-kanban"] }),
  });

  const filtered = useMemo(
    () => (batchFilter ? orders.filter((o) => (o.batch_code ?? "—") === batchFilter) : orders),
    [orders, batchFilter],
  );

  const grouped = useMemo(() => {
    const m = new Map<Stage, Order[]>();
    STAGES.forEach((s) => m.set(s.key, []));
    filtered.forEach((o) => m.get(o.stage)?.push(o));
    return m;
  }, [filtered]);

  const summary = useMemo(() => {
    const wip = orders
      .filter((o) => o.stage !== "entregue" && o.stage !== "cad")
      .reduce((s, o) => s + o.quantity, 0);
    const late = orders.filter((o) => {
      const d = daysTo(o.due_date);
      return o.stage !== "entregue" && d !== null && d < 0;
    }).length;
    const urgent = orders.filter((o) => o.priority <= 2 && o.stage !== "entregue").length;
    return { wip, late, urgent, total: orders.length };
  }, [orders]);

  const bottleneck = useMemo(() => {
    const now = Date.now();
    let worst: {
      stage: Stage;
      label: string;
      count: number;
      avgDays: number;
      oldest: number;
    } | null = null;
    for (const col of STAGES) {
      if (col.key === "entregue" || col.key === "cad") continue;
      const items = orders.filter((o) => o.stage === col.key);
      if (items.length < 2) continue;
      const days = items.map((o) => (now - new Date(o.stage_updated_at).getTime()) / 86400000);
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      const oldest = Math.max(...days);
      const score = avg * items.length;
      if (!worst || score > worst.avgDays * worst.count) {
        worst = { stage: col.key, label: col.label, count: items.length, avgDays: avg, oldest };
      }
    }
    if (!worst || worst.avgDays < 2) return null;
    return worst;
  }, [orders]);

  const move = (id: string, stage: Stage) => {
    const o = orders.find((x) => x.id === id);
    if (!o || o.stage === stage) return;
    // Gate de qualidade — bloqueia passagem para Expedição/Entregue quando há CAPA aberta.
    if ((stage === "expedicao" || stage === "entregue") && openCapaOrderIds.has(id)) {
      toast.error(`${o.code} tem CAPA de qualidade aberta — resolva antes de expedir.`, {
        action: { label: "Ver CAPA", onClick: () => window.open(`/quality`, "_self") },
      });
      return;
    }
    update.mutate({ id, stage });
    toast.success(`${o.code} → ${STAGES.find((s) => s.key === stage)?.label}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PCP — Passagem por setores</h1>
          <p className="text-sm text-muted-foreground">
            Arraste cards entre colunas para programar a passagem entre setores. Prioridade, prazo e
            tempo no setor visíveis em cada card.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {batchFilter && (
            <button
              onClick={() => setBatchFilter(null)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border bg-card hover:bg-muted"
              title="Limpar filtro de lote"
            >
              Lote: <span className="font-semibold tabular-nums">{batchFilter}</span>
              <X className="size-3" />
            </button>
          )}
          <div className="inline-flex rounded-md border border-border bg-card overflow-hidden text-xs">
            <button
              onClick={() => setMode("ordens")}
              className={`px-3 py-1.5 inline-flex items-center gap-1 ${mode === "ordens" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Factory className="size-3.5" /> Ordens
            </button>
            <button
              onClick={() => {
                setMode("lotes");
                setBatchFilter(null);
              }}
              className={`px-3 py-1.5 inline-flex items-center gap-1 ${mode === "lotes" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Package className="size-3.5" /> Lotes
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Ordens" value={summary.total} icon={<Factory className="size-4" />} />
        <KPI
          label="WIP (peças)"
          value={summary.wip.toLocaleString("pt-BR")}
          icon={<Clock className="size-4" />}
          tone="primary"
        />
        <KPI
          label="Atrasadas"
          value={summary.late}
          icon={<AlertTriangle className="size-4" />}
          tone="destructive"
        />
        <KPI
          label="Prioridade alta"
          value={summary.urgent}
          icon={<Flag className="size-4" />}
          tone="warning"
        />
      </div>

      <AICoordinatorPanel persona="pcp" title="Coordenador de PCP — leitura do kanban" />

      <DelayPredictionPanel />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" /> Próxima melhor ação
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {bottleneck
            ? `${bottleneck.label} concentra ${bottleneck.count} OPs por ${bottleneck.avgDays.toFixed(1)} dias em média. Trate essa coluna antes de abrir novas liberações.`
            : summary.late > 0
              ? `${summary.late} OPs já passaram do prazo. Filtre por prioridade alta e avance as passagens críticas primeiro.`
              : "Fluxo sem gargalo relevante agora. Use o modo Lotes para liberar blocos completos e reduzir passagens manuais."}
        </div>
      </div>

      {bottleneck && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-warning font-semibold">
            <Sparkles className="size-3.5" /> Gargalo detectado
          </div>
          <div className="flex-1 min-w-[220px] text-sm">
            <span className="font-semibold">{bottleneck.label}</span> · {bottleneck.count} OPs
            paradas há média de{" "}
            <span className="font-semibold tabular-nums">{bottleneck.avgDays.toFixed(1)}d</span>
            {bottleneck.oldest > bottleneck.avgDays + 1 &&
              ` (mais antiga: ${bottleneck.oldest.toFixed(0)}d)`}
            .
            <div className="text-xs text-muted-foreground mt-0.5">
              Realoque capacidade para {bottleneck.label.toLowerCase()} ou cobre o setor — segura
              toda a esteira a partir daqui.
            </div>
          </div>
          <button
            onClick={() => {
              setMode("ordens");
              const el = document.querySelector(`[data-stage="${bottleneck.stage}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="text-xs px-3 py-1.5 rounded-md bg-warning text-warning-foreground font-medium hover:bg-warning/90"
          >
            Ver coluna
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {STAGES.map((col) => {
          const items = grouped.get(col.key) ?? [];
          const qty = items.reduce((s, o) => s + o.quantity, 0);
          const isOver = over === col.key;
          return (
            <div
              key={col.key}
              data-stage={col.key}
              className={`rounded-xl border bg-card flex flex-col min-h-[420px] transition ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((v) => (v === col.key ? null : v))}
              onDrop={() => {
                if (dragging) {
                  move(dragging, col.key);
                  setDragging(null);
                  setOver(null);
                }
              }}
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {items.length} · {qty} pç
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">{col.hint}</div>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {isLoading ? (
                  <div className="text-xs text-muted-foreground p-2">Carregando…</div>
                ) : items.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground p-3 border border-dashed border-border rounded-lg text-center">
                    Solte aqui
                  </div>
                ) : mode === "lotes" && !batchFilter ? (
                  Array.from(
                    items
                      .reduce((m, o) => {
                        const k = o.batch_code ?? "—";
                        const v = m.get(k) ?? {
                          code: k,
                          qty: 0,
                          count: 0,
                          urgent: 0,
                          late: 0,
                          progressSum: 0,
                        };
                        v.qty += o.quantity;
                        v.count += 1;
                        v.progressSum += o.progress;
                        if (o.priority <= 2) v.urgent += 1;
                        const d = daysTo(o.due_date);
                        if (d !== null && d < 0 && col.key !== "entregue") v.late += 1;
                        m.set(k, v);
                        return m;
                      }, new Map<string, { code: string; qty: number; count: number; urgent: number; late: number; progressSum: number }>())
                      .values(),
                  ).map((b) => (
                    <div
                      key={b.code}
                      className="w-full rounded-lg border border-border bg-background p-2.5 text-xs space-y-1 hover:border-primary/50 transition"
                    >
                      <button onClick={() => setBatchFilter(b.code)} className="w-full text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold inline-flex items-center gap-1">
                            <Package className="size-3" />
                            {b.code}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {b.count} OPs
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground tabular-nums">
                          <span>{b.qty} pç</span>
                          <span>{Math.round(b.progressSum / b.count)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.round(b.progressSum / b.count)}%` }}
                          />
                        </div>
                        {(b.urgent > 0 || b.late > 0) && (
                          <div className="flex gap-1 pt-0.5">
                            {b.urgent > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500 border border-orange-500/30">
                                {b.urgent} urg
                              </span>
                            )}
                            {b.late > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
                                {b.late} atras
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoteDrawer(b.code);
                        }}
                        className="w-full mt-1 text-[10px] inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Ver referências e fichas de produção do lote"
                      >
                        <FileText className="size-3" /> Ver fichas do lote
                      </button>
                    </div>
                  ))
                ) : (
                  items.map((o) => {
                    const d = daysTo(o.due_date);
                    const overdue = d !== null && d < 0 && col.key !== "entregue";
                    const soon = d !== null && d >= 0 && d <= 3 && col.key !== "entregue";
                    const inStageH = Math.floor(
                      (Date.now() - new Date(o.stage_updated_at).getTime()) / 3600000,
                    );
                    const pri = PRIORITY[o.priority] ?? PRIORITY[3];
                    const nextStage = STAGES[STAGES.findIndex((s) => s.key === col.key) + 1];
                    return (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={() => setDragging(o.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        className={`group rounded-lg border bg-background p-2.5 text-xs space-y-1.5 cursor-grab active:cursor-grabbing hover:border-primary/50 transition ${overdue ? "border-destructive/60" : soon ? "border-orange-500/50" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums flex items-center gap-1">
                            {o.code}
                            {openCapaOrderIds.has(o.id) && (
                              <span
                                className="text-[9px] px-1 py-0.5 rounded border border-destructive/40 bg-destructive/10 text-destructive inline-flex items-center gap-0.5"
                                title="CAPA de qualidade aberta — não pode expedir"
                              >
                                <AlertTriangle className="size-2.5" /> CAPA
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1">
                            {o.product_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFichaDrawer({
                                    productId: o.product_id!,
                                    orderId: o.id,
                                    orderCode: o.code,
                                  });
                                }}
                                className="size-5 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-primary"
                                title="Abrir ficha de produção (sem valores)"
                              >
                                <FileText className="size-3.5" />
                              </button>
                            )}
                            <ProductionOrderCommentsButton
                              orderId={o.id}
                              orderCode={o.code}
                              ownerId={o.owner_id}
                            />
                            <ProductionOccurrenceButton
                              orderId={o.id}
                              orderCode={o.code}
                              ownerId={o.owner_id}
                              stage={col.key}
                            />
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${pri.tone}`}>
                              {pri.label}
                            </span>
                          </div>
                        </div>
                        {o.product && (
                          <div className="text-muted-foreground truncate" title={o.product}>
                            {o.product}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-muted-foreground tabular-nums">
                          <span>{o.quantity} pç</span>
                          <span>{o.progress}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <History className="size-3" />
                            {inStageH < 24
                              ? `${inStageH}h no setor`
                              : `${Math.floor(inStageH / 24)}d no setor`}
                          </span>
                          {o.due_date && (
                            <span
                              className={
                                overdue
                                  ? "text-destructive font-medium"
                                  : soon
                                    ? "text-orange-500 font-medium"
                                    : ""
                              }
                            >
                              {d! < 0 ? `${Math.abs(d!)}d atrasada` : d === 0 ? "hoje" : `${d}d`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 md:opacity-0 md:group-hover:opacity-100 transition">
                          <select
                            className="text-[10px] bg-muted/50 border border-border rounded px-1 py-0.5"
                            value={o.priority}
                            onChange={(e) =>
                              update.mutate({ id: o.id, priority: Number(e.target.value) })
                            }
                            aria-label="Prioridade"
                          >
                            {[1, 2, 3, 4, 5].map((p) => (
                              <option key={p} value={p}>
                                P{p}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            className="text-[10px] bg-muted/50 border border-border rounded px-1 py-0.5 flex-1 min-w-0"
                            value={o.due_date ?? ""}
                            onChange={(e) =>
                              update.mutate({ id: o.id, due_date: e.target.value || (null as any) })
                            }
                            aria-label="Prazo"
                          />
                          <select
                            className="text-[10px] bg-muted/50 border border-border rounded px-1 py-0.5"
                            value={col.key}
                            onChange={(e) => move(o.id, e.target.value as Stage)}
                            aria-label="Mover para setor"
                          >
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          {nextStage && (
                            <>
                              <QuickPassButton
                                orderId={o.id}
                                orderCode={o.code}
                                ownerId={o.owner_id}
                                fromStage={col.key}
                                toStage={nextStage.key}
                                remaining={Math.max(
                                  1,
                                  o.quantity - Math.floor((o.quantity * o.progress) / 100),
                                )}
                              />
                              <button
                                onClick={() => move(o.id, nextStage.key)}
                                className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                                title={`Avançar tudo para ${nextStage.label}`}
                              >
                                <ArrowRight className="size-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LoteReferencesDrawer
        batchCode={loteDrawer}
        open={!!loteDrawer}
        onOpenChange={(v) => !v && setLoteDrawer(null)}
      />
      <ProductionTechSheetDrawer
        productId={fichaDrawer?.productId}
        productionOrderId={fichaDrawer?.orderId}
        orderCode={fichaDrawer?.orderCode}
        open={!!fichaDrawer}
        onOpenChange={(v) => !v && setFichaDrawer(null)}
      />
    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "destructive" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-orange-500"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
