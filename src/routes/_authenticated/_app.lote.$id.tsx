import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Factory,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Package,
  ListChecks,
  ShieldAlert,
  Layers,
  FileText,
  ImageIcon,
  RefreshCcw,
  ClipboardList,
  Plus,
  Minus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ProductionOccurrenceButton } from "@/components/production-occurrence";
import { TechSheetDrawerTrigger } from "@/components/tech-sheet-drawer";
import { LoteQrButton } from "@/components/lote-qr-button";
import { BomExplosionDialog } from "@/components/bom-explosion-dialog";
import { LoteSplitDialog } from "@/components/lote-split-dialog";
import { LotePassagensPanel } from "@/components/lote-passagens-panel";

const OCC_KIND_LABEL: Record<string, string> = {
  positiva: "Positiva (+)",
  negativa: "Negativa (−)",
  neutra: "Neutra",
  falta_material: "Falta de material",
  erro_corte: "Erro de corte",
  erro_costura: "Erro de costura",
  defeito: "Defeito",
  retrabalho: "Retrabalho",
  atraso: "Atraso",
  outro: "Outro",
};
const OCC_KIND_TONE: Record<string, string> = {
  positiva: "bg-success/15 text-success border-success/30",
  negativa: "bg-destructive/15 text-destructive border-destructive/30",
  neutra: "bg-amber-500/15 text-amber-600 border-amber-500/30",
};
const OCC_STATUS_TONE: Record<string, string> = {
  aberta: "bg-destructive/15 text-destructive border-destructive/30",
  em_andamento: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolvida: "bg-success/15 text-success border-success/30",
};

export const Route = createFileRoute("/_authenticated/_app/lote/$id")({
  head: () => ({
    meta: [
      { title: "Lote · USE MODA PLM" },
      {
        name: "description",
        content: "Visão completa do lote: OPs, grade, ocorrências e timeline.",
      },
    ],
  }),
  component: LotePage,
});

const STAGE_LABEL: Record<string, string> = {
  cad: "CAD",
  modelagem: "Modelagem",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  concluido: "Concluído",
};

const STATUS_TONE: Record<string, string> = {
  planejado: "bg-muted text-muted-foreground border-border",
  em_producao: "bg-primary/15 text-primary border-primary/30",
  finalizado: "bg-success/15 text-success border-success/30",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1) return `${Math.floor(diff / 60000)} min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function LotePage() {
  const { id } = useParams({ from: "/_authenticated/_app/lote/$id" });
  useRealtime("production_orders", ["lote-orders", id]);
  useRealtime("production_stage_log", ["lote-logs", id]);

  const { data: batch, isLoading } = useQuery({
    queryKey: ["lote", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_batches")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [] } = useQuery({
    enabled: !!batch?.code,
    queryKey: ["lote-orders", batch?.code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(
          "id, code, stage, status, quantity, progress, due_date, stage_updated_at, product_id, supplier_id, owner_id, products(name, sku, image_url), suppliers(name)",
        )
        .eq("batch_code", batch!.code)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const orderIds = orders.map((o) => o.id);
  const { data: logs = [] } = useQuery({
    enabled: orderIds.length > 0,
    queryKey: ["lote-logs", orderIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stage_log")
        .select("id, order_id, from_stage, to_stage, quantity, note, is_partial, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data as any[];
    },
  });

  useRealtime("production_occurrences", ["lote-occ", id]);
  const { data: occurrences = [] } = useQuery({
    enabled: orderIds.length > 0 || !!batch?.id,
    queryKey: ["lote-occ", batch?.id, orderIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("production_occurrences")
        .select(
          "id, kind, sector, status, affected_qty, description, created_at, resolved_at, order_id, batch_id",
        )
        .order("created_at", { ascending: false });
      if (orderIds.length > 0 && batch?.id) {
        q = q.or(`batch_id.eq.${batch.id},order_id.in.(${orderIds.join(",")})`);
      } else if (batch?.id) {
        q = q.eq("batch_id", batch.id);
      } else {
        q = q.in("order_id", orderIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const productIds = Array.from(new Set(orders.map((o) => o.product_id).filter(Boolean)));
  const { data: materialsNeeded = [] } = useQuery({
    enabled: productIds.length > 0,
    queryKey: ["lote-materials", productIds.join(",")],
    queryFn: async () => {
      const { data: sheets, error: e1 } = await supabase
        .from("tech_sheets")
        .select("id, product_id, status")
        .in("product_id", productIds as string[])
        .eq("status", "aprovada");
      if (e1) throw e1;
      const sheetIds = (sheets ?? []).map((s) => s.id);
      if (sheetIds.length === 0) return [] as any[];
      const sheetToProduct = new Map((sheets ?? []).map((s) => [s.id, s.product_id]));
      const { data: mats, error: e2 } = await supabase
        .from("tech_sheet_materials")
        .select("tech_sheet_id, inventory_item_id, name, consumption, loss_pct, unit, unit_cost")
        .in("tech_sheet_id", sheetIds);
      if (e2) throw e2;
      const invIds = Array.from(
        new Set((mats ?? []).map((m) => m.inventory_item_id).filter(Boolean)),
      );
      const { data: inv } = invIds.length
        ? await supabase
            .from("inventory_items")
            .select("id, name, sku, unit, balance, minimum, photo_url")
            .in("id", invIds as string[])
        : { data: [] as any[] };
      const invMap = new Map((inv ?? []).map((i: any) => [i.id, i]));
      // aggregate per inventory_item_id (or name when no link)
      const agg = new Map<string, any>();
      for (const m of mats ?? []) {
        const productId = sheetToProduct.get(m.tech_sheet_id);
        const totalQty = orders
          .filter((o) => o.product_id === productId)
          .reduce((s, o) => s + Number(o.quantity || 0), 0);
        if (totalQty === 0) continue;
        const need = Number(m.consumption || 0) * (1 + Number(m.loss_pct || 0) / 100) * totalQty;
        const key = m.inventory_item_id ?? `name:${m.name}`;
        const inv = m.inventory_item_id ? invMap.get(m.inventory_item_id) : null;
        const cur = agg.get(key) ?? {
          key,
          inventory_item_id: m.inventory_item_id,
          name: inv?.name ?? m.name,
          sku: inv?.sku ?? null,
          unit: m.unit || inv?.unit || "un",
          photo_url: inv?.photo_url ?? null,
          balance: inv ? Number(inv.balance || 0) : null,
          minimum: inv ? Number(inv.minimum || 0) : null,
          needed: 0,
          cost: 0,
        };
        cur.needed += need;
        cur.cost += need * Number(m.unit_cost || 0);
        agg.set(key, cur);
      }
      return Array.from(agg.values()).sort((a, b) => b.needed - a.needed);
    },
  });

  const summary = useMemo(() => {
    const total = orders.reduce((s, o) => s + (o.quantity ?? 0), 0);
    const done = orders.filter((o) => o.stage === "concluido").length;
    const pct = orders.length ? Math.round((done / orders.length) * 100) : 0;
    const late = orders.filter(
      (o) => o.due_date && new Date(o.due_date).getTime() < Date.now() && o.stage !== "concluido",
    );
    const byStage = new Map<string, number>();
    orders.forEach((o) => byStage.set(o.stage, (byStage.get(o.stage) ?? 0) + 1));
    const occOpen = occurrences.filter((o) => o.status !== "resolvida").length;
    const occPos = occurrences
      .filter((o) => o.kind === "positiva")
      .reduce((s, o) => s + Number(o.affected_qty || 0), 0);
    const occNeg = occurrences
      .filter((o) => o.kind === "negativa")
      .reduce((s, o) => s + Number(o.affected_qty || 0), 0);
    const finalForecast = Math.max(0, total + occPos - occNeg);
    const matMissing = materialsNeeded.filter(
      (m) => m.balance !== null && m.needed > m.balance,
    ).length;
    return {
      total,
      done,
      pct,
      late: late.length,
      byStage: [...byStage.entries()],
      occOpen,
      occPos,
      occNeg,
      finalForecast,
      matMissing,
    };
  }, [orders, occurrences, materialsNeeded]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!batch) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/lotes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
          Lote não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/lotes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Lotes
          </Button>
        </Link>
        <Badge variant="outline" className={STATUS_TONE[batch.status] ?? ""}>
          {batch.status}
        </Badge>
        <div className="ml-auto">
          <LoteQrButton batchCode={batch.code} batchId={batch.id} />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="size-12 rounded-xl bg-primary/10 grid place-items-center">
          <Boxes className="size-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Lote {batch.code}</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} OPs · {summary.total} peças · {summary.done}/{orders.length} concluídas
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">{summary.pct}%</div>
          <div className="text-xs text-muted-foreground">progresso</div>
        </div>
      </div>

      <Progress value={summary.pct} className="h-2" />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card icon={Package} label="Peças programadas" value={summary.total} />
        <Card
          icon={Plus}
          label="Positivas (+)"
          value={summary.occPos}
          tone={summary.occPos > 0 ? "text-success" : "text-muted-foreground"}
        />
        <Card
          icon={Minus}
          label="Negativas (−)"
          value={summary.occNeg}
          tone={summary.occNeg > 0 ? "text-destructive" : "text-muted-foreground"}
        />
        <Card
          icon={CheckCircle2}
          label="Saldo final previsto"
          value={summary.finalForecast}
          tone="text-primary"
        />
        <Card
          icon={AlertTriangle}
          label="Atrasadas"
          value={summary.late}
          tone={summary.late > 0 ? "text-destructive" : "text-success"}
        />
        <Card
          icon={ShieldAlert}
          label="Ocorr. abertas"
          value={summary.occOpen}
          tone={summary.occOpen > 0 ? "text-destructive" : "text-success"}
        />
        <Card
          icon={Layers}
          label="Materiais em falta"
          value={summary.matMissing}
          tone={summary.matMissing > 0 ? "text-destructive" : "text-success"}
        />
      </div>

      {summary.byStage.length > 0 && (
        <div className="glass rounded-xl p-4">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ListChecks className="size-4 text-primary" /> Distribuição por etapa
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.byStage.map(([stage, n]) => (
              <Badge key={stage} variant="outline" className="bg-muted/40">
                {STAGE_LABEL[stage] ?? stage} · {n}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold mb-3">Referências do lote</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
              <div className="flex gap-3">
                <div className="size-16 rounded-lg overflow-hidden bg-muted/40 shrink-0">
                  {o.products?.image_url ? (
                    <img
                      src={o.products.image_url}
                      alt={o.products?.name}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full grid place-items-center text-[10px] text-muted-foreground">
                      sem foto
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] text-muted-foreground">{o.code}</div>
                  <div className="text-sm font-medium truncate">{o.products?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {o.suppliers?.name ?? "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30 text-[10px]"
                >
                  {STAGE_LABEL[o.stage] ?? o.stage}
                </Badge>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {o.quantity} pç · {o.progress ?? 0}%
                </span>
              </div>
              {o.stage_updated_at && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" /> nesta etapa há {relTime(o.stage_updated_at)}
                </div>
              )}
              <div className="grid grid-cols-6 gap-1 pt-1 border-t border-border/60">
                <RefMenuLink
                  to="/movimentacoes"
                  search={{ op: o.code } as any}
                  icon={ArrowRight}
                  label="Passagem 1ª"
                  title="Passagem 1ª linha (entrada/saída entre setores)"
                />
                <TechSheetDrawerTrigger
                  productId={o.product_id}
                  productName={o.products?.name}
                  productSku={o.products?.sku}
                  productImage={o.products?.image_url}
                  orderCode={o.code}
                />
                <BomExplosionDialog productionOrderId={o.id} orderCode={o.code} />
                <RefMenuLink
                  to="/produtos"
                  search={{ q: o.products?.sku ?? o.code } as any}
                  icon={ImageIcon}
                  label="Layout"
                  title="Arte / layout visual"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById(`occ-retrabalho-${o.id}`)?.click()}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-md hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground"
                  title="Passagem 2ª linha (retrabalho)"
                >
                  <RefreshCcw className="size-3.5" />
                  <span>2ª linha</span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById(`occ-default-${o.id}`)?.click()}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-md hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground"
                  title="Registrar ocorrência"
                >
                  <ClipboardList className="size-3.5" />
                  <span>Ocorrência</span>
                </button>
              </div>
              <div className="hidden">
                <span id={`occ-default-${o.id}`}>
                  <ProductionOccurrenceButton
                    orderId={o.id}
                    orderCode={o.code}
                    ownerId={o.owner_id}
                    stage={o.stage}
                    batchId={batch?.id}
                  />
                </span>
                <span id={`occ-retrabalho-${o.id}`}>
                  <ProductionOccurrenceButton
                    orderId={o.id}
                    orderCode={o.code}
                    ownerId={o.owner_id}
                    stage={o.stage}
                    batchId={batch?.id}
                  />
                </span>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-6">
              Sem OPs vinculadas a este lote.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Materiais necessários
            <span className="text-[11px] font-normal text-muted-foreground ml-auto">
              {materialsNeeded.length} item(s) · de fichas aprovadas
            </span>
          </div>
          {materialsNeeded.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem materiais vinculados (cadastre ficha técnica aprovada para os produtos).
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {materialsNeeded.map((m: any) => {
                const linked = m.balance !== null;
                const missing = linked && m.needed > m.balance;
                const cobertura =
                  linked && m.needed > 0
                    ? Math.min(100, Math.round((m.balance / m.needed) * 100))
                    : null;
                return (
                  <div
                    key={m.key}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-2.5"
                  >
                    <div className="size-10 rounded bg-muted/40 overflow-hidden shrink-0">
                      {m.photo_url ? (
                        <img
                          src={m.photo_url}
                          alt={m.name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {m.sku ? `${m.sku} · ` : ""}precisa {m.needed.toFixed(2)} {m.unit}
                        {linked
                          ? ` · tem ${m.balance.toFixed(2)} ${m.unit}`
                          : " · não vinculado ao estoque"}
                      </div>
                    </div>
                    <div className="text-right">
                      {linked ? (
                        <Badge
                          variant="outline"
                          className={
                            missing
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : "bg-success/15 text-success border-success/30"
                          }
                        >
                          {missing
                            ? `faltam ${(m.needed - m.balance).toFixed(1)} ${m.unit}`
                            : `${cobertura}% coberto`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted/40 text-muted-foreground">
                          sem vínculo
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-4">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" /> Ocorrências do lote
            <span className="text-[11px] font-normal text-muted-foreground ml-auto">
              {occurrences.length} total · {summary.occOpen} aberta(s)
            </span>
          </div>
          {occurrences.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem ocorrências registradas.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {occurrences.map((o: any) => {
                const op = orders.find((x) => x.id === o.order_id);
                return (
                  <li key={o.id} className="rounded-lg border border-border bg-card/50 p-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={OCC_KIND_TONE[o.kind] ?? "bg-muted/40"}>
                        {OCC_KIND_LABEL[o.kind] ?? o.kind}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={OCC_STATUS_TONE[o.status] ?? "bg-muted/40"}
                      >
                        {o.status}
                      </Badge>
                      {o.sector && (
                        <span className="text-[10px] text-muted-foreground">
                          · {STAGE_LABEL[o.sector] ?? o.sector}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        há {relTime(o.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {op?.code ?? "—"} ·{" "}
                      {o.kind === "positiva" ? "+" : o.kind === "negativa" ? "−" : ""}
                      {o.affected_qty ?? 0} pç
                    </div>
                    {o.description && <div className="text-xs mt-1 italic">"{o.description}"</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="text-sm font-semibold mb-3">Linha do tempo do lote</div>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem movimentações registradas.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-3 max-h-96 overflow-y-auto pr-2">
            {logs.map((l) => {
              const op = orders.find((o) => o.id === l.order_id);
              return (
                <li key={l.id} className="pl-5 relative">
                  <span className="absolute -left-1.5 top-1.5 size-3 rounded-full bg-primary border-2 border-background" />
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {l.from_stage && (
                      <>
                        <span className="text-muted-foreground">
                          {STAGE_LABEL[l.from_stage] ?? l.from_stage}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </>
                    )}
                    <span>{STAGE_LABEL[l.to_stage] ?? l.to_stage}</span>
                    {l.is_partial && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px]"
                      >
                        parcial
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {op?.code} · {l.quantity} pç · há {relTime(l.created_at)}
                  </div>
                  {l.note && (
                    <div className="text-[11px] italic text-muted-foreground mt-0.5">
                      "{l.note}"
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function RefMenuLink({
  to,
  search,
  icon: Icon,
  label,
  title,
}: {
  to: string;
  search?: Record<string, unknown>;
  icon: any;
  label: string;
  title: string;
}) {
  return (
    <Link
      to={to as any}
      search={search as any}
      className="flex flex-col items-center gap-0.5 py-1.5 rounded-md hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground"
      title={title}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </Link>
  );
}
