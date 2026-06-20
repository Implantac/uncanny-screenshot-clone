import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Factory,
  AlertTriangle,
  Clock,
  Package,
  Truck,
  Filter,
  Download,
  X,
  History,
  CheckCircle2,
  CircleSlash,
  Sparkles,
  TrendingDown,
  ArrowRight,
  MessageSquareWarning,
  Timer,
  Maximize2,
  Minimize2,
  Zap,
  Radio,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { moveOrderToColumn } from "@/lib/production-tracking.functions";
import { predictDelays, type DelayPrediction } from "@/lib/delay-prediction.functions";
import { useRealtime } from "@/hooks/use-realtime";
import { ProductionCardActions } from "@/components/production-card-actions";
import { ViewPresetsDropdown, type ViewPresetFilters } from "@/components/view-presets-dropdown";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  colKey: fallback(z.string(), "").default(""),
  supplierId: fallback(z.string(), "").default(""),
  statusF: fallback(z.string(), "").default(""),
  origin: fallback(z.enum(["", "interna", "externa"]), "").default(""),
  collection: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  productGroup: fallback(z.string(), "").default(""),
  productLine: fallback(z.string(), "").default(""),
  supplierCat: fallback(z.string(), "").default(""),
  dueFrom: fallback(z.string(), "").default(""),
  dueTo: fallback(z.string(), "").default(""),
  listFilter: fallback(z.enum(["", "no_prazo", "atrasado", "finalizado"]), "").default(""),
  groupBy: fallback(z.enum(["none", "collection", "supplier", "line"]), "none").default("none"),
});

export const Route = createFileRoute("/_authenticated/_app/acompanhamento-producao")({
  validateSearch: zodValidator(searchSchema),
  component: AcompanhamentoProducao,
});

type Stage =
  | "cad"
  | "corte"
  | "costura"
  | "acabamento"
  | "qualidade"
  | "expedicao"
  | "entregue";

type Order = {
  id: string;
  code: string;
  stage: Stage;
  quantity: number;
  progress: number;
  due_date: string | null;
  stage_updated_at: string;
  batch_code: string | null;
  outsourced: boolean | null;
  notes: string | null;
  product_id: string | null;
  supplier_id: string | null;
  owner_id: string;
  supplier_name: string | null;
  supplier_category: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_image_url: string | null;
  product_category: string | null;
  product_group: string | null;
  product_line: string | null;
  collection_name: string | null;
};

type HistoryRow = {
  id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  created_at: string;
  note: string | null;
  quantity: number | null;
};

// 12 colunas conforme protótipo, derivadas de (stage, outsourced)
type Col = {
  key: string;
  label: string;
  match: (o: Order) => boolean;
};

const COLUMNS: Col[] = [
  { key: "aguardando_corte", label: "Aguardando Corte", match: (o) => o.stage === "cad" },
  { key: "em_corte", label: "Em Corte", match: (o) => o.stage === "corte" },
  {
    key: "aguardando_costura",
    label: "Aguardando Costura",
    match: (o) => o.stage === "costura" && (o.progress ?? 0) === 0,
  },
  {
    key: "costura_interna",
    label: "Costura Interna",
    match: (o) => o.stage === "costura" && !o.outsourced && (o.progress ?? 0) > 0,
  },
  {
    key: "costura_externa",
    label: "Costura Externa",
    match: (o) => o.stage === "costura" && !!o.outsourced && (o.progress ?? 0) > 0,
  },
  {
    key: "aguardando_acabamento",
    label: "Aguardando Acabamento",
    match: (o) => o.stage === "acabamento" && (o.progress ?? 0) === 0,
  },
  {
    key: "acabamento_interno",
    label: "Acabamento Interno",
    match: (o) => o.stage === "acabamento" && !o.outsourced && (o.progress ?? 0) > 0,
  },
  {
    key: "acabamento_externo",
    label: "Acabamento Externo",
    match: (o) => o.stage === "acabamento" && !!o.outsourced && (o.progress ?? 0) > 0,
  },
  { key: "revisao", label: "Revisão / Qualidade", match: (o) => o.stage === "qualidade" },
  {
    key: "embalagem",
    label: "Embalagem",
    match: (o) => o.stage === "expedicao" && (o.progress ?? 0) < 100,
  },
  {
    key: "expedicao",
    label: "Pronto p/ Expedição",
    match: (o) => o.stage === "expedicao" && (o.progress ?? 0) >= 100,
  },
  { key: "finalizado", label: "Finalizado", match: (o) => o.stage === "entregue" },
];

type StatusKey = "no_prazo" | "atencao" | "atrasado" | "sem_previsao" | "finalizado";

const STATUS_META: Record<StatusKey, { label: string; cls: string; dot: string }> = {
  no_prazo: {
    label: "No prazo",
    cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  atencao: {
    label: "Atenção",
    cls: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    dot: "bg-amber-500",
  },
  atrasado: {
    label: "Atrasado",
    cls: "bg-red-500/10 text-red-600 border-red-500/30",
    dot: "bg-red-500",
  },
  sem_previsao: {
    label: "Sem previsão",
    cls: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  finalizado: {
    label: "Finalizado",
    cls: "bg-sky-500/10 text-sky-600 border-sky-500/30",
    dot: "bg-sky-500",
  },
};

function statusOf(o: Order): StatusKey {
  if (o.stage === "entregue") return "finalizado";
  if (!o.due_date) return "sem_previsao";
  const days = Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return "atrasado";
  if (days <= 1) return "atencao";
  return "no_prazo";
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

async function load(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("production_orders")
    .select(
      `id, code, stage, quantity, progress, due_date, stage_updated_at, batch_code, outsourced, notes,
       product_id, supplier_id, owner_id,
       suppliers(name, category),
       products(name, sku, image_url, category, product_group, collections(name), product_lines(name))`,
    )
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    id: o.id,
    code: o.code,
    stage: o.stage,
    quantity: o.quantity ?? 0,
    progress: o.progress ?? 0,
    due_date: o.due_date,
    stage_updated_at: o.stage_updated_at,
    batch_code: o.batch_code,
    outsourced: o.outsourced,
    notes: o.notes,
    product_id: o.product_id,
    supplier_id: o.supplier_id,
    owner_id: o.owner_id,
    supplier_name: o.suppliers?.name ?? null,
    supplier_category: o.suppliers?.category ?? null,
    product_name: o.products?.name ?? null,
    product_sku: o.products?.sku ?? null,
    product_image_url: o.products?.image_url ?? null,
    product_category: o.products?.category ?? null,
    product_group: o.products?.product_group ?? null,
    product_line: o.products?.product_lines?.name ?? null,
    collection_name: o.products?.collections?.name ?? null,
  })) as Order[];
}

function AcompanhamentoProducao() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["acompanhamento-producao"],
    queryFn: load,
  });

  // Realtime: invalida quando OPs ou passagens mudam (apontamentos de outros usuários, ERP, etc.)
  useRealtime("production_orders", ["acompanhamento-producao"]);
  useRealtime("production_stage_log", ["acompanhamento-producao"]);

  // Predição de atrasos por OP — cache 5 min, indexado por orderId
  const { data: prediction } = useQuery({
    queryKey: ["acompanhamento-producao", "predict"],
    queryFn: () => predictDelays(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const predByOrder = useMemo(() => {
    const m = new Map<string, DelayPrediction>();
    (prediction?.items ?? []).forEach((p) => m.set(p.orderId, p));
    return m;
  }, [prediction]);

  // Filtros sincronizados com URL (link compartilhável)
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const updateSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });
  const { q, colKey, supplierId, collection, category, productGroup, productLine, supplierCat, dueFrom, dueTo, groupBy } = search;
  const statusF = search.statusF as StatusKey | "";
  const origin = search.origin;
  const listFilter = search.listFilter;
  const setQ = (v: string) => updateSearch({ q: v });
  const setColKey = (v: string) => updateSearch({ colKey: v });
  const setSupplierId = (v: string) => updateSearch({ supplierId: v });
  const setStatusF = (v: StatusKey | "") => updateSearch({ statusF: v });
  const setOrigin = (v: "" | "interna" | "externa") => updateSearch({ origin: v });
  const setCollection = (v: string) => updateSearch({ collection: v });
  const setCategory = (v: string) => updateSearch({ category: v });
  const setProductGroup = (v: string) => updateSearch({ productGroup: v });
  const setProductLine = (v: string) => updateSearch({ productLine: v });
  const setSupplierCat = (v: string) => updateSearch({ supplierCat: v });
  const setDueFrom = (v: string) => updateSearch({ dueFrom: v });
  const setDueTo = (v: string) => updateSearch({ dueTo: v });
  const setListFilter = (v: "" | "no_prazo" | "atrasado" | "finalizado") => updateSearch({ listFilter: v });
  const setGroupBy = (v: "none" | "collection" | "supplier" | "line") => updateSearch({ groupBy: v });

  // UI state local (não vai pra URL)
  const [drawer, setDrawer] = useState<Order | null>(null);
  const [zoomCol, setZoomCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [tvMode, setTvMode] = useState(false);

  // Auto-refresh periódico no modo TV (além do realtime, garante UI viva)
  useEffect(() => {
    if (!tvMode) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["acompanhamento-producao"] });
    }, 30_000);
    return () => clearInterval(id);
  }, [tvMode, qc]);

  const move = useMutation({
    mutationFn: (vars: { orderId: string; toColumn: string }) =>
      moveOrderToColumn({ data: vars }),
    onSuccess: () => {
      toast.success("Lote movido");
      qc.invalidateQueries({ queryKey: ["acompanhamento-producao"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao mover"),
  });

  const suppliers = useMemo(() => {
    const m = new Map<string, string>();
    orders.forEach((o) => {
      if (o.supplier_id && o.supplier_name) m.set(o.supplier_id, o.supplier_name);
    });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [orders]);

  const collections = useMemo(
    () => Array.from(new Set(orders.map((o) => o.collection_name).filter(Boolean))) as string[],
    [orders],
  );
  const categories = useMemo(
    () => Array.from(new Set(orders.map((o) => o.product_category).filter(Boolean))) as string[],
    [orders],
  );
  const productGroups = useMemo(
    () => Array.from(new Set(orders.map((o) => o.product_group).filter(Boolean))) as string[],
    [orders],
  );
  const productLines = useMemo(
    () => Array.from(new Set(orders.map((o) => o.product_line).filter(Boolean))) as string[],
    [orders],
  );
  const supplierCats = useMemo(
    () => Array.from(new Set(orders.map((o) => o.supplier_category).filter(Boolean))) as string[],
    [orders],
  );

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (q) {
        const hay =
          `${o.code} ${o.batch_code ?? ""} ${o.product_name ?? ""} ${o.product_sku ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (colKey) {
        const col = COLUMNS.find((c) => c.key === colKey);
        if (col && !col.match(o)) return false;
      }
      if (supplierId && o.supplier_id !== supplierId) return false;
      if (origin === "interna" && o.outsourced) return false;
      if (origin === "externa" && !o.outsourced) return false;
      if (statusF && statusOf(o) !== statusF) return false;
      if (collection && o.collection_name !== collection) return false;
      if (category && o.product_category !== category) return false;
      if (productGroup && o.product_group !== productGroup) return false;
      if (productLine && o.product_line !== productLine) return false;
      if (supplierCat && o.supplier_category !== supplierCat) return false;
      if (dueFrom && (!o.due_date || o.due_date < dueFrom)) return false;
      if (dueTo && (!o.due_date || o.due_date > dueTo)) return false;
      return true;
    });
  }, [orders, q, colKey, supplierId, origin, statusF, collection, category, productGroup, productLine, supplierCat, dueFrom, dueTo]);

  // KPIs
  const kpis = useMemo(() => {
    const wip = filtered.filter((o) => o.stage !== "entregue");
    const lotes = new Set(filtered.map((o) => o.batch_code ?? o.id));
    const internos = wip.filter((o) => !o.outsourced);
    const externos = wip.filter((o) => o.outsourced);
    const atrasados = wip.filter((o) => statusOf(o) === "atrasado");
    const avgDays = wip.length
      ? wip.reduce((s, o) => s + daysSince(o.stage_updated_at), 0) / wip.length
      : 0;
    return {
      lotesProd: lotes.size,
      pcsProd: wip.reduce((s, o) => s + o.quantity, 0),
      lotesInt: new Set(internos.map((o) => o.batch_code ?? o.id)).size,
      lotesExt: new Set(externos.map((o) => o.batch_code ?? o.id)).size,
      lotesAtr: new Set(atrasados.map((o) => o.batch_code ?? o.id)).size,
      pcsAtr: atrasados.reduce((s, o) => s + o.quantity, 0),
      avgDays: Math.round(avgDays * 10) / 10,
    };
  }, [filtered]);

  // Agrupamentos kanban
  const grouped = useMemo(() => {
    const m = new Map<string, Order[]>();
    COLUMNS.forEach((c) => m.set(c.key, []));
    filtered.forEach((o) => {
      const col = COLUMNS.find((c) => c.match(o));
      if (col) m.get(col.key)!.push(o);
    });
    return m;
  }, [filtered]);

  // Resumo por setor
  const sectorSummary = useMemo(() => {
    return COLUMNS.map((c) => {
      const items = grouped.get(c.key) ?? [];
      const qty = items.reduce((s, o) => s + o.quantity, 0);
      let noPrazo = 0,
        atencao = 0,
        atrasado = 0;
      items.forEach((o) => {
        const s = statusOf(o);
        if (s === "no_prazo") noPrazo++;
        else if (s === "atencao") atencao++;
        else if (s === "atrasado") atrasado++;
      });
      return { setor: c.label, key: c.key, lotes: items.length, pecas: qty, noPrazo, atencao, atrasado };
    });
  }, [grouped]);

  // Resumo por terceiro
  const supplierSummary = useMemo(() => {
    const m = new Map<
      string,
      { terceiro: string; processo: string; lotes: number; pecas: number; noPrazo: number; atrasado: number }
    >();
    filtered
      .filter((o) => o.outsourced && o.supplier_id)
      .forEach((o) => {
        const key = `${o.supplier_id}|${o.stage}`;
        const v = m.get(key) ?? {
          terceiro: o.supplier_name ?? "—",
          processo: stageLabel(o.stage),
          lotes: 0,
          pecas: 0,
          noPrazo: 0,
          atrasado: 0,
        };
        v.lotes += 1;
        v.pecas += o.quantity;
        const s = statusOf(o);
        if (s === "no_prazo") v.noPrazo++;
        if (s === "atrasado") v.atrasado++;
        m.set(key, v);
      });
    return Array.from(m.values()).sort((a, b) => b.pecas - a.pecas);
  }, [filtered]);

  // INSIGHTS — Coordenador PCP: gargalos, riscos e sugestões com motivo
  const insights = useMemo(() => {
    const cards: Array<{
      tone: "warn" | "danger" | "ok" | "info";
      title: string;
      reason: string;
      action?: { label: string; onClick: () => void };
    }> = [];

    // 1) Coluna com mais atrasados
    const colLate = sectorSummary
      .filter((s) => s.atrasado > 0)
      .sort((a, b) => b.atrasado - a.atrasado)[0];
    if (colLate) {
      cards.push({
        tone: "danger",
        title: `${colLate.setor}: ${colLate.atrasado} lote(s) atrasado(s)`,
        reason: `Este setor concentra o maior volume de atrasos no recorte atual (${colLate.pecas.toLocaleString("pt-BR")} peças, ${colLate.lotes} lote(s)). Priorize para destravar o fluxo a jusante.`,
        action: { label: "Filtrar setor", onClick: () => setColKey(colLate.key) },
      });
    }

    // 2) Lotes parados há muito tempo no mesmo setor (top 1)
    const stalled = filtered
      .filter((o) => o.stage !== "entregue")
      .map((o) => ({ o, d: daysSince(o.stage_updated_at) }))
      .sort((a, b) => b.d - a.d)[0];
    if (stalled && stalled.d >= 5) {
      cards.push({
        tone: "warn",
        title: `Lote ${stalled.o.batch_code ?? stalled.o.code} parado há ${stalled.d} dias`,
        reason: `Está em "${COLUMNS.find((c) => c.match(stalled.o))?.label ?? stalled.o.stage}"${stalled.o.supplier_name ? ` com ${stalled.o.supplier_name}` : ""}. Bata na porta do responsável ou abra uma ocorrência.`,
        action: { label: "Abrir histórico", onClick: () => setDrawer(stalled.o) },
      });
    }

    // 3) Terceiro com risco
    const riskySup = supplierSummary
      .filter((s) => s.atrasado > 0)
      .sort((a, b) => b.atrasado - a.atrasado)[0];
    if (riskySup) {
      cards.push({
        tone: "warn",
        title: `${riskySup.terceiro} com ${riskySup.atrasado} atraso(s) em ${riskySup.processo}`,
        reason: `${riskySup.pecas.toLocaleString("pt-BR")} peças neste fornecedor. Considere renegociar prazo ou redistribuir parte do lote para outro parceiro com folga.`,
      });
    }

    // 4) Sucesso: setores 100% no prazo
    const allGreen = sectorSummary.filter(
      (s) => s.lotes > 0 && s.atrasado === 0 && s.atencao === 0,
    );
    if (cards.length === 0 && allGreen.length > 0) {
      cards.push({
        tone: "ok",
        title: "Fluxo saudável",
        reason: `${allGreen.length} setor(es) com 100% no prazo. Aproveite para puxar OPs da fila de "Aguardando".`,
      });
    }

    // 5) Recomendação tática: muitos lotes em "Aguardando" vs setor seguinte vazio
    const pairs: Array<[string, string]> = [
      ["aguardando_costura", "costura_interna"],
      ["aguardando_acabamento", "acabamento_interno"],
    ];
    pairs.forEach(([waitKey, nextKey]) => {
      const wait = sectorSummary.find((s) => s.key === waitKey);
      const next = sectorSummary.find((s) => s.key === nextKey);
      if (wait && next && wait.lotes >= 3 && next.lotes <= 1) {
        cards.push({
          tone: "info",
          title: `Fila em "${wait.setor}" vs "${next.setor}" ocioso`,
          reason: `Há ${wait.lotes} lote(s) parado(s) aguardando enquanto a célula seguinte está com ${next.lotes}. Puxe os próximos lotes (arraste no kanban) para nivelar a carga.`,
        });
      }
    });

    return cards.slice(0, 4);
  }, [sectorSummary, supplierSummary, filtered]);

  // SLA por setor (horas-alvo por etapa) — saúde do fluxo
  const SLA_HOURS: Record<string, number> = {
    aguardando_corte: 24,
    em_corte: 48,
    aguardando_costura: 24,
    costura_interna: 96,
    costura_externa: 168,
    aguardando_acabamento: 24,
    acabamento_interno: 48,
    acabamento_externo: 96,
    revisao: 24,
    embalagem: 24,
    expedicao: 24,
  };
  const slaBySetor = useMemo(() => {
    const map = new Map<string, { setor: string; key: string; target: number; lotes: number; within: number; avgH: number }>();
    filtered
      .filter((o) => o.stage !== "entregue")
      .forEach((o) => {
        const col = COLUMNS.find((c) => c.match(o));
        if (!col || col.key === "finalizado") return;
        const target = SLA_HOURS[col.key] ?? 48;
        const h = (Date.now() - new Date(o.stage_updated_at).getTime()) / 3600000;
        const v = map.get(col.key) ?? { setor: col.label, key: col.key, target, lotes: 0, within: 0, avgH: 0 };
        v.lotes += 1;
        if (h <= target) v.within += 1;
        v.avgH += h;
        map.set(col.key, v);
      });
    return Array.from(map.values())
      .map((v) => ({ ...v, avgH: Math.round(v.avgH / Math.max(1, v.lotes)), pct: Math.round((v.within / Math.max(1, v.lotes)) * 100) }))
      .sort((a, b) => a.pct - b.pct);
  }, [filtered]);

  const clearFilters = () => {
    setQ("");
    setColKey("");
    setSupplierId("");
    setStatusF("");
    setOrigin("");
    setCollection("");
    setCategory("");
    setProductGroup("");
    setProductLine("");
    setSupplierCat("");
    setDueFrom("");
    setDueTo("");
  };

  // KPIs gerenciais derivados (gargalo / risco)
  const topBottleneck = useMemo(
    () => [...sectorSummary].sort((a, b) => b.lotes - a.lotes)[0],
    [sectorSummary],
  );
  const topRiskySupplier = useMemo(
    () => [...supplierSummary].sort((a, b) => b.atrasado - a.atrasado)[0],
    [supplierSummary],
  );

  // Contagem por status (para chips e respostas rápidas)
  const statusCounts = useMemo(() => {
    const acc: Record<StatusKey, number> = {
      no_prazo: 0,
      atencao: 0,
      atrasado: 0,
      sem_previsao: 0,
      finalizado: 0,
    };
    filtered.forEach((o) => {
      acc[statusOf(o)] += 1;
    });
    return acc;
  }, [filtered]);

  // Top lotes parados — score combina dias no setor + atraso vs entrega + volume
  // Threshold mínimo: 3 dias no mesmo setor (evita ruído de lotes recém-movidos)
  const STALLED_MIN_DAYS = 3;
  const stalledTop = useMemo(() => {
    const enriched = filtered
      .filter((o) => o.stage !== "entregue")
      .map((o) => {
        const dias = daysSince(o.stage_updated_at);
        const diasAteEntrega = o.due_date
          ? Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 86400000)
          : null;
        const atrasoEntrega = diasAteEntrega !== null && diasAteEntrega < 0 ? -diasAteEntrega : 0;
        // Score: dias parado pesa 1x, atraso de entrega pesa 2x (impacto no cliente),
        // bônus por urgência (entrega <=1d) e por volume (acima de 100 peças).
        const urgenciaBonus = diasAteEntrega !== null && diasAteEntrega <= 1 && diasAteEntrega >= 0 ? 4 : 0;
        const volumeBonus = (o.quantity ?? 0) >= 100 ? 2 : 0;
        const score = dias + atrasoEntrega * 2 + urgenciaBonus + volumeBonus;
        const severity: "critico" | "alto" | "medio" =
          score >= 15 || atrasoEntrega >= 3 ? "critico" : score >= 8 ? "alto" : "medio";
        return { o, dias, diasAteEntrega, atrasoEntrega, score, severity };
      })
      .filter((x) => x.dias >= STALLED_MIN_DAYS)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const totalPecas = enriched.reduce((s, x) => s + (x.o.quantity ?? 0), 0);
    const totalDias = enriched.reduce((s, x) => s + x.dias, 0);
    return { rows: enriched, totalPecas, totalDias };
  }, [filtered]);

  const SEVERITY_META: Record<"critico" | "alto" | "medio", { label: string; cls: string; dot: string }> = {
    critico: { label: "Crítico", cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40", dot: "bg-red-500" },
    alto: { label: "Alto", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40", dot: "bg-amber-500" },
    medio: { label: "Médio", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40", dot: "bg-yellow-400" },
  };

  // Chips de filtros ativos
  const activeChips = useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = [];
    if (q) chips.push({ label: `Busca: "${q}"`, clear: () => setQ("") });
    if (colKey)
      chips.push({
        label: `Setor: ${COLUMNS.find((c) => c.key === colKey)?.label}`,
        clear: () => setColKey(""),
      });
    if (supplierId)
      chips.push({
        label: `Terceiro: ${suppliers.find((s) => s.id === supplierId)?.name ?? ""}`,
        clear: () => setSupplierId(""),
      });
    if (origin)
      chips.push({
        label: origin === "interna" ? "Somente interna" : "Somente externa",
        clear: () => setOrigin(""),
      });
    if (statusF)
      chips.push({ label: `Status: ${STATUS_META[statusF].label}`, clear: () => setStatusF("") });
    if (collection) chips.push({ label: `Coleção: ${collection}`, clear: () => setCollection("") });
    if (category) chips.push({ label: `Tipo: ${category}`, clear: () => setCategory("") });
    if (productLine) chips.push({ label: `Linha: ${productLine}`, clear: () => setProductLine("") });
    if (productGroup) chips.push({ label: `Grupo: ${productGroup}`, clear: () => setProductGroup("") });
    if (supplierCat) chips.push({ label: `Cat. terceiro: ${supplierCat}`, clear: () => setSupplierCat("") });
    if (dueFrom) chips.push({ label: `De ${dueFrom}`, clear: () => setDueFrom("") });
    if (dueTo) chips.push({ label: `Até ${dueTo}`, clear: () => setDueTo("") });
    return chips;
  }, [q, colKey, supplierId, origin, statusF, collection, category, productGroup, productLine, supplierCat, dueFrom, dueTo, suppliers]);


  const exportRows = () => {
    exportToCsv(
      `acompanhamento-producao-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((o) => ({
        OP: o.code,
        Lote: o.batch_code ?? "",
        Referencia: o.product_sku ?? "",
        Produto: o.product_name ?? "",
        Colecao: o.collection_name ?? "",
        Categoria: o.product_category ?? "",
        Setor: COLUMNS.find((c) => c.match(o))?.label ?? stageLabel(o.stage),
        Tipo: o.outsourced ? "Externa" : "Interna",
        Terceiro: o.supplier_name ?? "",
        Quantidade: o.quantity,
        Produzido: Math.round((o.progress / 100) * o.quantity),
        EntradaSetor: o.stage_updated_at,
        PrevisaoSaida: o.due_date ?? "",
        DiasNoSetor: daysSince(o.stage_updated_at),
        Status: STATUS_META[statusOf(o)].label,
        Observacao: o.notes ?? "",
      })),
    );
  };

  return (
    <div className={`p-4 md:p-6 space-y-4 ${tvMode ? "text-base" : ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            Acompanhamento de Produção
            <span
              title="Atualização em tempo real ativa"
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
            >
              <Radio className="size-2.5 animate-pulse" /> live
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Onde está cada lote agora — interno, externo, prazo e gargalo, em uma única tela.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Agrupar por (swimlanes) */}
          <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground border border-border rounded-md bg-card px-2 py-1">
            <span>Agrupar:</span>
            {(
              [
                ["none", "—"],
                ["collection", "Coleção"],
                ["supplier", "Terceiro"],
                ["line", "Linha"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setGroupBy(k)}
                className={`px-1.5 py-0.5 rounded ${
                  groupBy === k ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTvMode((v) => !v)}
            title={tvMode ? "Sair do modo painel" : "Modo painel (TV chão de fábrica)"}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border ${
              tvMode
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {tvMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            Modo painel
          </button>
          <ViewPresetsDropdown
            module="acompanhamento_producao"
            current={{
              q, colKey, supplierId, statusF, origin, collection, category,
              productGroup, productLine, supplierCat, dueFrom, dueTo,
              listFilter, groupBy,
            }}
            onClear={() => {
              setQ(""); setColKey(""); setSupplierId(""); setStatusF("");
              setOrigin(""); setCollection(""); setCategory(""); setProductGroup("");
              setProductLine(""); setSupplierCat(""); setDueFrom(""); setDueTo("");
              setListFilter(""); setGroupBy("none");
            }}
            onApply={(f: ViewPresetFilters) => {
              const s = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
              if (s("q") !== undefined) setQ(s("q")!);
              if (s("colKey") !== undefined) setColKey(s("colKey")!);
              if (s("supplierId") !== undefined) setSupplierId(s("supplierId")!);
              if (s("statusF") !== undefined) setStatusF(s("statusF") as StatusKey | "");
              if (s("origin") !== undefined) setOrigin(s("origin") as "" | "interna" | "externa");
              if (s("collection") !== undefined) setCollection(s("collection")!);
              if (s("category") !== undefined) setCategory(s("category")!);
              if (s("productGroup") !== undefined) setProductGroup(s("productGroup")!);
              if (s("productLine") !== undefined) setProductLine(s("productLine")!);
              if (s("supplierCat") !== undefined) setSupplierCat(s("supplierCat")!);
              if (s("dueFrom") !== undefined) setDueFrom(s("dueFrom")!);
              if (s("dueTo") !== undefined) setDueTo(s("dueTo")!);
              if (s("listFilter") !== undefined)
                setListFilter(s("listFilter") as "" | "no_prazo" | "atrasado" | "finalizado");
              if (s("groupBy") !== undefined)
                setGroupBy(s("groupBy") as "none" | "collection" | "supplier" | "line");
            }}
          />
          <button
            onClick={exportRows}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border bg-card hover:bg-muted"
          >
            <Download className="size-3.5" /> Exportar Excel/CSV
          </button>
        </div>
      </header>

      {/* FILTROS */}
      {!tvMode && (
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="size-3.5" /> Filtros
          </div>
          <button
            onClick={clearFilters}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X className="size-3" /> Limpar
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="OP, lote, produto, ref…"
            className="col-span-2 text-xs px-2 py-1.5 rounded border border-border bg-background"
          />
          <select
            value={colKey}
            onChange={(e) => setColKey(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Setor atual</option>
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Terceiro</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as any)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Interna + Externa</option>
            <option value="interna">Somente Interna</option>
            <option value="externa">Somente Externa</option>
          </select>
          <select
            value={statusF}
            onChange={(e) => setStatusF(e.target.value as any)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Status do prazo</option>
            <option value="no_prazo">No prazo</option>
            <option value="atencao">Atenção</option>
            <option value="atrasado">Atrasado</option>
            <option value="sem_previsao">Sem previsão</option>
            <option value="finalizado">Finalizado</option>
          </select>
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Coleção</option>
            {collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Tipo de produto</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={productLine}
            onChange={(e) => setProductLine(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Linha de produto</option>
            {productLines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={productGroup}
            onChange={(e) => setProductGroup(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Grupo / Gênero</option>
            {productGroups.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={supplierCat}
            onChange={(e) => setSupplierCat(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="">Categoria do terceiro</option>
            {supplierCats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
            />
            <span className="text-[10px] text-muted-foreground">→</span>
            <input
              type="date"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
            />
          </div>
        </div>

        {/* Chips de filtros ativos */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {activeChips.map((c, i) => (
              <button
                key={i}
                onClick={c.clear}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                title="Remover filtro"
              >
                {c.label}
                <X className="size-2.5" />
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {!tvMode && (<>
      {/* CHIPS DE STATUS — filtragem em 1 clique */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["no_prazo", "atencao", "atrasado", "sem_previsao", "finalizado"] as StatusKey[]).map(
          (s) => {
            const active = statusF === s;
            return (
              <button
                key={s}
                onClick={() => setStatusF(active ? "" : s)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                  active
                    ? `${STATUS_META[s].cls} ring-2 ring-offset-1 ring-offset-background ring-current/30`
                    : `${STATUS_META[s].cls} opacity-70 hover:opacity-100`
                }`}
              >
                <span className={`size-1.5 rounded-full ${STATUS_META[s].dot}`} />
                {STATUS_META[s].label}
                <span className="tabular-nums font-semibold">{statusCounts[s]}</span>
              </button>
            );
          },
        )}
      </div>



      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
        <KPI label="Lotes em produção" value={kpis.lotesProd} icon={<Package className="size-4" />} />
        <KPI
          label="Peças em produção"
          value={kpis.pcsProd.toLocaleString("pt-BR")}
          icon={<Factory className="size-4" />}
          tone="primary"
        />
        <KPI label="Lotes internos" value={kpis.lotesInt} icon={<CheckCircle2 className="size-4" />} />
        <KPI label="Lotes externos" value={kpis.lotesExt} icon={<Truck className="size-4" />} />
        <KPI
          label="Lotes atrasados"
          value={kpis.lotesAtr}
          icon={<AlertTriangle className="size-4" />}
          tone="destructive"
        />
        <KPI
          label="Peças atrasadas"
          value={kpis.pcsAtr.toLocaleString("pt-BR")}
          icon={<Clock className="size-4" />}
          tone="destructive"
        />
        <KPI
          label="Dias médios no setor"
          value={`${kpis.avgDays}d`}
          icon={<Clock className="size-4" />}
        />
        <KPI
          label="Setor com mais acúmulo"
          value={topBottleneck && topBottleneck.lotes > 0 ? `${topBottleneck.setor} · ${topBottleneck.lotes}` : "—"}
          icon={<Factory className="size-4" />}
          tone="warning"
        />
        <KPI
          label="Terceiro com mais atraso"
          value={topRiskySupplier && topRiskySupplier.atrasado > 0 ? `${topRiskySupplier.terceiro} · ${topRiskySupplier.atrasado}` : "—"}
          icon={<Truck className="size-4" />}
          tone="destructive"
        />
      </div>

      {/* INSIGHTS — Coordenador PCP */}
      {insights.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" /> Coordenador PCP — insights do recorte atual
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {insights.map((c, i) => {
              const tones: Record<string, string> = {
                danger: "border-red-500/40 bg-red-500/5",
                warn: "border-amber-500/40 bg-amber-500/5",
                ok: "border-emerald-500/40 bg-emerald-500/5",
                info: "border-sky-500/40 bg-sky-500/5",
              };
              const iconTones: Record<string, string> = {
                danger: "text-red-600",
                warn: "text-amber-600",
                ok: "text-emerald-600",
                info: "text-sky-600",
              };
              return (
                <div key={i} className={`rounded-lg border p-3 ${tones[c.tone]}`}>
                  <div
                    className={`flex items-start gap-2 text-sm font-semibold ${iconTones[c.tone]}`}
                  >
                    <TrendingDown className="size-4 mt-0.5 shrink-0" />
                    <span>{c.title}</span>
                  </div>
                  <div className="text-xs text-foreground/80 mt-1">{c.reason}</div>
                  {c.action && (
                    <button
                      onClick={c.action.onClick}
                      className="mt-2 text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {c.action.label} <ArrowRight className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Dica: arraste um lote entre colunas do kanban para registrar a passagem de etapa.
          </div>
        </section>
      )}

      {/* SLA por setor */}
      {slaBySetor.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-2">
              <Clock className="size-3.5" /> SLA por setor — % de lotes dentro do tempo-alvo
            </div>
            <div className="text-[10px] text-muted-foreground">
              meta = horas-alvo por etapa · vermelho &lt;60% · âmbar 60–84% · verde ≥85%
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-2">
            {slaBySetor.map((s) => {
              const tone = s.pct >= 85 ? "emerald" : s.pct >= 60 ? "amber" : "red";
              const colorMap: Record<string, string> = {
                emerald: "bg-emerald-500",
                amber: "bg-amber-500",
                red: "bg-red-500",
              };
              const textMap: Record<string, string> = {
                emerald: "text-emerald-600",
                amber: "text-amber-600",
                red: "text-red-600",
              };
              return (
                <button
                  key={s.key}
                  onClick={() => setColKey(s.key)}
                  className="min-w-0 text-left rounded-lg border border-border bg-background p-2.5 hover:border-primary transition"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium" title={s.setor}>{s.setor}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${textMap[tone]}`}>{s.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded mt-1.5 overflow-hidden">
                    <div className={`h-full ${colorMap[tone]}`} style={{ width: `${s.pct}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-1 tabular-nums">
                    <span className="min-w-0 truncate">{s.lotes} lote(s) · média {s.avgH}h</span>
                    <span className="shrink-0">meta {s.target}h</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      </>)}

      {/* KANBAN */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {COLUMNS.filter((c) => !tvMode || (grouped.get(c.key) ?? []).length > 0).map((col) => {
            const items = grouped.get(col.key) ?? [];
            const qty = items.reduce((s, o) => s + o.quantity, 0);
            const lateInCol = items.filter((o) => statusOf(o) === "atrasado").length;
            const opened = zoomCol === col.key;
            const isOver = dragOverCol === col.key;
            // Próxima coluna válida para a ação "Avançar" (apenas em colunas de stages avançáveis)
            const colIdx = COLUMNS.findIndex((c) => c.key === col.key);
            const nextCol = colIdx >= 0 && colIdx < COLUMNS.length - 1 ? COLUMNS[colIdx + 1] : null;
            // Swimlanes
            const lanes = (() => {
              if (groupBy === "none") return [{ key: "__all", label: "", items }];
              const m = new Map<string, Order[]>();
              items.forEach((o) => {
                const k =
                  groupBy === "collection"
                    ? o.collection_name ?? "Sem coleção"
                    : groupBy === "supplier"
                      ? o.outsourced
                        ? o.supplier_name ?? "Terceiro s/ nome"
                        : "Interna"
                      : o.product_line ?? "Sem linha";
                m.set(k, [...(m.get(k) ?? []), o]);
              });
              return Array.from(m, ([key, lItems]) => ({ key, label: key, items: lItems })).sort(
                (a, b) => b.items.length - a.items.length,
              );
            })();
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  if (draggingId) {
                    e.preventDefault();
                    setDragOverCol(col.key);
                  }
                }}
                onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const id = e.dataTransfer.getData("text/plain") || draggingId;
                  if (!id) return;
                  const order = orders.find((o) => o.id === id);
                  if (!order) return;
                  const curCol = COLUMNS.find((c) => c.match(order));
                  if (curCol?.key === col.key) return;
                  move.mutate({ orderId: id, toColumn: col.key });
                }}
                className={`${tvMode ? "w-[320px]" : "w-[280px]"} flex-shrink-0 rounded-xl border bg-card flex flex-col transition ${
                  isOver ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <button
                  onClick={() => setZoomCol(opened ? null : col.key)}
                  className="px-2 py-2 border-b border-border text-left hover:bg-muted/50 rounded-t-xl min-w-0"
                >
                  <div className={`font-semibold truncate ${tvMode ? "text-sm" : "text-[11px]"}`} title={col.label}>
                    {col.label}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] tabular-nums text-muted-foreground min-w-0">
                    <span className="truncate">{items.length} lote · {qty} pç</span>
                    {lateInCol > 0 && (
                      <span className="shrink-0 font-semibold text-red-600 inline-flex items-center gap-0.5">
                        <AlertTriangle className="size-2.5" /> {lateInCol}
                      </span>
                    )}
                  </div>
                </button>
                <div className={`p-2 space-y-2 overflow-y-auto ${tvMode ? "max-h-[78vh]" : "max-h-[520px]"}`}>
                  {isLoading ? (
                    <div className="text-xs text-muted-foreground p-2">Carregando…</div>
                  ) : items.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground p-3 border border-dashed border-border rounded-lg text-center">
                      {isOver ? "Solte aqui" : "Vazio"}
                    </div>
                  ) : (
                    lanes.map((lane) => (
                      <div key={lane.key} className="space-y-2">
                        {groupBy !== "none" && (
                          <div className="sticky top-0 z-[1] bg-card/95 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 py-0.5 border-b border-border/60 flex items-center justify-between">
                            <span className="truncate">{lane.label}</span>
                            <span className="tabular-nums">{lane.items.length}</span>
                          </div>
                        )}
                        {lane.items.map((o) => (
                          <CardLote
                            key={o.id}
                            o={o}
                            tvMode={tvMode}
                            prediction={predByOrder.get(o.id) ?? null}
                            slaTargetH={SLA_HOURS[col.key]}
                            nextColumnKey={nextCol?.key ?? null}
                            nextColumnLabel={nextCol?.label ?? null}
                            onOpen={() => setDrawer(o)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", o.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingId(o.id);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverCol(null);
                            }}
                            dragging={draggingId === o.id}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!tvMode && (<>
      {/* RESUMO POR SETOR */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Resumo por setor</div>
          <div className="text-[10px] text-muted-foreground">
            Clique no setor p/ filtrar o kanban (visão micro)
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Setor</th>
              <th className="text-right px-3 py-2">Lotes</th>
              <th className="text-right px-3 py-2">Peças</th>
              <th className="text-right px-3 py-2">No prazo</th>
              <th className="text-right px-3 py-2">Atenção</th>
              <th className="text-right px-3 py-2">Atrasado</th>
            </tr>
          </thead>
          <tbody>
            {sectorSummary.map((r) => (
              <tr key={r.key} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <button
                    onClick={() => setColKey(r.key)}
                    className="text-left hover:underline font-medium"
                  >
                    {r.setor}
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.lotes}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pecas.toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{r.noPrazo}</td>
                <td className="px-3 py-2 text-right tabular-nums text-yellow-400 font-semibold">{r.atencao}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.atrasado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* RESUMO POR TERCEIRO */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-sm font-semibold">
          Resumo por terceiro
        </div>
        {supplierSummary.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            Nenhum lote em terceiro no filtro atual.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Terceiro</th>
                <th className="text-left px-3 py-2">Processo</th>
                <th className="text-right px-3 py-2">Lotes</th>
                <th className="text-right px-3 py-2">Peças</th>
                <th className="text-right px-3 py-2">No prazo</th>
                <th className="text-right px-3 py-2">Atrasado</th>
              </tr>
            </thead>
            <tbody>
              {supplierSummary.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.terceiro}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.processo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.lotes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.pecas.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{r.noPrazo}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.atrasado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* TOP LOTES PARADOS — "Qual produto está parado há mais tempo?" */}
      {stalledTop.rows.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="px-4 py-2 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold inline-flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Timer className="size-4" /> Lotes parados há mais tempo
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                ≥ {STALLED_MIN_DAYS} dias no mesmo setor • ordenado por criticidade
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Package className="size-3" />
                <span className="font-semibold text-foreground">
                  {stalledTop.totalPecas.toLocaleString("pt-BR")}
                </span>{" "}
                peças paradas
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                <span className="font-semibold text-foreground">{stalledTop.totalDias}</span> dias
                acumulados
              </span>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2">Severidade</th>
                <th className="text-left px-3 py-2">Lote / OP</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-left px-3 py-2">Setor</th>
                <th className="text-left px-3 py-2">Local</th>
                <th className="text-right px-3 py-2">Qtde</th>
                <th className="text-right px-3 py-2">Dias parado</th>
                <th className="text-right px-3 py-2">Entrega</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {stalledTop.rows.map(({ o, dias, diasAteEntrega, atrasoEntrega, severity }) => {
                const st = statusOf(o);
                const col = COLUMNS.find((c) => c.match(o));
                const sev = SEVERITY_META[severity];
                return (
                  <tr
                    key={o.id}
                    onClick={() => setDrawer(o)}
                    className="border-t border-border hover:bg-amber-500/5 cursor-pointer"
                  >
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${sev.cls}`}
                      >
                        <span className={`size-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-semibold">{o.batch_code ?? o.code}</td>
                    <td className="px-3 py-1.5">
                      <div className="truncate max-w-[260px]">{o.product_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{o.product_sku ?? ""}</div>
                    </td>
                    <td className="px-3 py-1.5">{col?.label ?? stageLabel(o.stage)}</td>
                    <td className="px-3 py-1.5">
                      {o.outsourced ? o.supplier_name ?? "Externo" : "Interna"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {(o.quantity ?? 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      {dias}d
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {diasAteEntrega === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : atrasoEntrega > 0 ? (
                        <span className="text-red-600 font-semibold">+{atrasoEntrega}d atraso</span>
                      ) : diasAteEntrega === 0 ? (
                        <span className="text-amber-600 font-semibold">hoje</span>
                      ) : (
                        <span className="text-muted-foreground">em {diasAteEntrega}d</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${STATUS_META[st].cls}`}
                      >
                        <span className={`size-1.5 rounded-full ${STATUS_META[st].dot}`} />
                        {STATUS_META[st].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* LISTA DETALHADA */}

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        {(() => {
          const listRows = listFilter
            ? filtered.filter((o) => statusOf(o) === listFilter)
            : filtered;
          const counts = {
            no_prazo: filtered.filter((o) => statusOf(o) === "no_prazo").length,
            atrasado: filtered.filter((o) => statusOf(o) === "atrasado").length,
            finalizado: filtered.filter((o) => statusOf(o) === "finalizado").length,
          };
          const chip = (
            key: "" | "no_prazo" | "atrasado" | "finalizado",
            label: string,
            count: number,
            activeCls: string,
          ) => {
            const active = listFilter === key;
            return (
              <button
                key={key || "all"}
                onClick={() => setListFilter(key)}
                className={`px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${
                  active
                    ? activeCls
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
                <span className="ml-1 tabular-nums opacity-80">{count}</span>
              </button>
            );
          };
          return (
            <>
              <div className="px-4 py-2 border-b border-border text-sm font-semibold flex flex-wrap items-center justify-between gap-2">
                <span>Lista detalhada ({listRows.length})</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {chip("", "Todos", filtered.length, "border-primary/40 bg-primary/10 text-primary")}
                  {chip("no_prazo", "No prazo", counts.no_prazo, STATUS_META.no_prazo.cls)}
                  {chip("atrasado", "Atrasado", counts.atrasado, STATUS_META.atrasado.cls)}
                  {chip("finalizado", "Finalizado", counts.finalizado, STATUS_META.finalizado.cls)}
                </div>
              </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2">Lote / OP</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-left px-3 py-2">Setor</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Terceiro</th>
                <th className="text-right px-3 py-2">Qtde</th>
                <th className="text-left px-3 py-2">Entrada</th>
                <th className="text-left px-3 py-2">Previsão</th>
                <th className="text-right px-3 py-2">Dias</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {listRows.slice(0, 200).map((o) => {
                const st = statusOf(o);
                const col = COLUMNS.find((c) => c.match(o));
                return (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-1.5">
                      <div className="font-semibold">{o.batch_code ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{o.code}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div>{o.product_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{o.product_sku ?? ""}</div>
                    </td>
                    <td className="px-3 py-1.5">{col?.label ?? stageLabel(o.stage)}</td>
                    <td className="px-3 py-1.5">{o.outsourced ? "Externa" : "Interna"}</td>
                    <td className="px-3 py-1.5">{o.supplier_name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{o.quantity}</td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {new Date(o.stage_updated_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {o.due_date ? new Date(o.due_date).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {daysSince(o.stage_updated_at)}d
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${STATUS_META[st].cls}`}
                      >
                        <span className={`size-1.5 rounded-full ${STATUS_META[st].dot}`} />
                        {STATUS_META[st].label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => setDrawer(o)}
                        className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <History className="size-3" /> Histórico
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {listRows.length > 200 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              Mostrando 200 de {listRows.length} — refine os filtros ou exporte.
            </div>
          )}
        </div>
            </>
          );
        })()}
      </section>
      </>)}

      {drawer && <HistoryDrawer order={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function CardLote({
  o,
  tvMode,
  prediction,
  slaTargetH,
  nextColumnKey,
  nextColumnLabel,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  o: Order;
  tvMode?: boolean;
  prediction?: DelayPrediction | null;
  slaTargetH?: number;
  nextColumnKey?: string | null;
  nextColumnLabel?: string | null;
  onOpen: () => void;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const st = statusOf(o);
  const dias = daysSince(o.stage_updated_at);
  const produced = Math.round((o.progress / 100) * o.quantity);
  const elapsedH = (Date.now() - new Date(o.stage_updated_at).getTime()) / 36e5;
  const slaBreached = slaTargetH != null && elapsedH > slaTargetH;
  const risk = prediction?.risk;
  const riskCls =
    risk === "high"
      ? "bg-red-500"
      : risk === "medium"
        ? "bg-amber-500"
        : risk === "low"
          ? "bg-emerald-500"
          : "";
  const borderCls = slaBreached
    ? "border-red-500/70 ring-2 ring-red-500/20 animate-pulse"
    : dragging
      ? "border-primary opacity-40"
      : "border-border";
  return (
    <div
      className={`group relative rounded-lg border bg-background hover:border-primary/50 transition ${borderCls}`}
    >
      {/* Badge de risco (predição) — canto superior esquerdo */}
      {risk && (
        <span
          title={prediction?.reason ?? ""}
          className={`absolute -left-1 top-2 size-2.5 rounded-full ring-2 ring-background ${riskCls}`}
        />
      )}
      <button
        onClick={onOpen}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`w-full text-left p-2 space-y-1 cursor-grab active:cursor-grabbing ${tvMode ? "text-sm" : ""}`}
      >
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className={`font-semibold inline-flex items-center gap-1 min-w-0 truncate ${tvMode ? "text-sm" : "text-[11px]"}`}>
            <Package className="size-3 shrink-0" />
            <span className="truncate">{o.batch_code ?? o.code}</span>
          </span>
          <span className={`shrink-0 whitespace-nowrap text-[9px] px-1 py-0.5 rounded border ${STATUS_META[st].cls}`}>
            {STATUS_META[st].label}
          </span>
        </div>
        <div className={`text-foreground/90 truncate ${tvMode ? "text-sm" : "text-[11px]"}`}>
          {o.product_name ?? "—"}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">Ref. {o.product_sku ?? "—"}</div>
        <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground tabular-nums min-w-0">
          <span className="shrink-0">
            {produced}/{o.quantity} pç
          </span>
          <span className={`truncate text-right ${slaBreached ? "text-red-600 font-semibold" : ""}`}>
            {dias}d{slaTargetH ? `/${Math.round(slaTargetH / 24)}d` : ""}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
        </div>
        <div className="flex items-center justify-between gap-1 text-[10px] min-w-0">
          <span
            className={`inline-flex items-center gap-1 min-w-0 truncate ${o.outsourced ? "text-amber-600" : "text-emerald-600"}`}
          >
            {o.outsourced ? <Truck className="size-3 shrink-0" /> : <Factory className="size-3 shrink-0" />}
            <span className="truncate">{o.outsourced ? o.supplier_name ?? "Externo" : "Interna"}</span>
          </span>
          {o.due_date && (
            <span className="shrink-0 text-muted-foreground tabular-nums whitespace-nowrap">
              {new Date(o.due_date).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
        {prediction && prediction.predictedDelayHours >= 8 && (
          <div className="flex items-start gap-1 text-[10px] text-red-600 border-t border-red-500/20 pt-1 mt-1">
            <Zap className="size-3 shrink-0 mt-px" />
            <span className="line-clamp-2">
              Previsão: +{prediction.predictedDelayHours}h após o prazo
            </span>
          </div>
        )}
        {o.notes && !prediction && (
          <div className="flex items-start gap-1 text-[10px] text-muted-foreground border-t border-border/60 pt-1 mt-1">
            <MessageSquareWarning className="size-3 shrink-0 mt-px text-amber-600" />
            <span className="line-clamp-1 italic">{o.notes}</span>
          </div>
        )}
      </button>
      {/* Ações rápidas — não no modo TV (somente leitura) */}
      {!tvMode && (
        <div className="absolute right-1 top-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <ProductionCardActions
            order={{
              id: o.id,
              code: o.code,
              batch_code: o.batch_code,
              owner_id: o.owner_id,
              quantity: o.quantity,
              progress: o.progress,
              stage: o.stage,
            }}
            nextColumnKey={nextColumnKey ?? null}
            nextColumnLabel={nextColumnLabel ?? null}
            onOpenHistory={onOpen}
            invalidateKey={["acompanhamento-producao"]}
          />
        </div>
      )}
    </div>
  );
}

function HistoryDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["op-history", order.id],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from("production_stage_log")
        .select("id, from_stage, to_stage, created_at, note, quantity")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const st = statusOf(order);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[520px] bg-background border-l border-border h-full overflow-y-auto">
        <div className="p-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Lote / OP</div>
            <div className="text-lg font-semibold">{order.batch_code ?? order.code}</div>
            <div className="text-xs text-muted-foreground">{order.code}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <Row label="Produto" value={`${order.product_name ?? "—"} · Ref. ${order.product_sku ?? "—"}`} />
          <Row label="Coleção" value={order.collection_name ?? "—"} />
          <Row label="Quantidade" value={`${order.quantity} pç (${Math.round((order.progress / 100) * order.quantity)} concluídas)`} />
          <Row
            label="Setor atual"
            value={COLUMNS.find((c) => c.match(order))?.label ?? stageLabel(order.stage)}
          />
          <Row label="Tipo" value={order.outsourced ? "Externa" : "Interna"} />
          <Row label="Terceiro" value={order.supplier_name ?? "—"} />
          <Row
            label="Entrada no setor"
            value={new Date(order.stage_updated_at).toLocaleString("pt-BR")}
          />
          <Row
            label="Previsão de saída"
            value={order.due_date ? new Date(order.due_date).toLocaleDateString("pt-BR") : "—"}
          />
          <Row label="Dias no setor" value={`${daysSince(order.stage_updated_at)} dias`} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-32">Status</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${STATUS_META[st].cls}`}>
              <span className={`size-1.5 rounded-full ${STATUS_META[st].dot}`} />
              {STATUS_META[st].label}
            </span>
          </div>
          {order.notes && <Row label="Observação" value={order.notes} />}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de passagens
          </div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CircleSlash className="size-3" /> Sem passagens registradas.
            </div>
          ) : (
            <ol className="space-y-2">
              {history.map((h, i) => {
                const next = history[i + 1];
                const days = next
                  ? Math.max(
                      0,
                      Math.floor(
                        (new Date(next.created_at).getTime() - new Date(h.created_at).getTime()) /
                          86400000,
                      ),
                    )
                  : daysSince(h.created_at);
                return (
                  <li
                    key={h.id}
                    className="flex items-start gap-2 text-xs border-l-2 border-primary/40 pl-2"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {h.from_stage ? `${stageLabel(h.from_stage)} → ` : ""}
                        {stageLabel(h.to_stage)}
                      </div>
                      <div className="text-muted-foreground tabular-nums">
                        {new Date(h.created_at).toLocaleString("pt-BR")} · {days}d{" "}
                        {h.quantity ? `· ${h.quantity} pç` : ""}
                      </div>
                      {h.note && <div className="text-muted-foreground italic mt-0.5">{h.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-xs">{value}</span>
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
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "destructive" | "warning";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    destructive: "text-red-600",
    warning: "text-amber-600",
  };
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="min-w-0 leading-tight break-words">{label}</span>
      </div>
      <div className={`mt-2 text-xl font-semibold leading-tight tabular-nums break-words ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function stageLabel(s: Stage): string {
  switch (s) {
    case "cad":
      return "CAD / Modelagem";
    case "corte":
      return "Corte";
    case "costura":
      return "Costura";
    case "acabamento":
      return "Acabamento";
    case "qualidade":
      return "Revisão / Qualidade";
    case "expedicao":
      return "Expedição";
    case "entregue":
      return "Finalizado";
  }
}
