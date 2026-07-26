import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Loader2,
  WifiOff,
  CloudUpload,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/apontar/$id")({
  head: () => ({
    meta: [
      { title: "Apontar produção · USE MODA PLM" },
      { name: "description", content: "Tela mobile para apontar passagem entre setores." },
    ],
  }),
  component: ApontarPage,
});

type Stage =
  | "compras"
  | "corte"
  | "bordado"
  | "bordado_terc"
  | "silk"
  | "silk_terc"
  | "costura"
  | "costura_terc"
  | "acabamento"
  | "entregue";

const STAGES: { key: Stage; label: string }[] = [
  { key: "compras", label: "Compras" },
  { key: "corte", label: "Corte" },
  { key: "bordado", label: "Bordado" },
  { key: "bordado_terc", label: "Bordado Terc." },
  { key: "silk", label: "Silk" },
  { key: "silk_terc", label: "Silk Terc." },
  { key: "costura", label: "Costura" },
  { key: "costura_terc", label: "Costura Terc." },
  { key: "acabamento", label: "Acabamento" },
  { key: "entregue", label: "Entregue" },
];

const QUEUE_KEY = "apontar:queue:v1";

type QueuedMove = {
  id: string;
  order_id: string;
  owner_id: string;
  from_stage: Stage;
  to_stage: Stage;
  quantity: number;
  is_partial: boolean;
  note: string | null;
  created_by: string | null;
  advance_stage: boolean;
  ts: number;
};

function readQueue(): QueuedMove[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: QueuedMove[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

async function flushQueue(): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  const q = readQueue();
  if (!q.length) return { ok, fail };
  const remaining: QueuedMove[] = [];
  for (const m of q) {
    try {
      const { error } = await supabase.from("production_stage_log").insert({
        owner_id: m.owner_id,
        order_id: m.order_id,
        from_stage: m.from_stage,
        to_stage: m.to_stage,
        quantity: m.quantity,
        is_partial: m.is_partial,
        note: m.note,
        created_by: m.created_by,
      } as any);
      if (error) throw error;
      if (m.advance_stage) {
        await supabase
          .from("production_orders")
          .update({ stage: m.to_stage as any, stage_updated_at: new Date().toISOString() })
          .eq("id", m.order_id);
      }
      ok++;
    } catch {
      fail++;
      remaining.push(m);
    }
  }
  writeQueue(remaining);
  return { ok, fail };
}

function relTime(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1) return `${Math.floor(diff / 60000)} min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ApontarPage() {
  const { id } = useParams({ from: "/_authenticated/_app/apontar/$id" });
  const qc = useQueryClient();
  useRealtime("production_orders", ["apontar", id]);

  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const refresh = () => setQueueSize(readQueue().length);
    refresh();
    const onOnline = async () => {
      setOnline(true);
      const r = await flushQueue();
      refresh();
      if (r.ok) toast.success(`${r.ok} apontamento(s) enviado(s) da fila offline`);
      if (r.fail) toast.error(`${r.fail} apontamento(s) falharam ao sincronizar`);
      qc.invalidateQueries({ queryKey: ["apontar", id] });
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const t = setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(t);
    };
  }, [id, qc]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["apontar", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(
          "id, code, stage, quantity, progress, due_date, stage_updated_at, batch_code, owner_id, products(name, sku, image_url), suppliers(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const stageIdx = useMemo(
    () => STAGES.findIndex((s) => s.key === (order?.stage as Stage)),
    [order?.stage],
  );
  const nextStage = stageIdx >= 0 && stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;
  const prevStage = stageIdx > 0 ? STAGES[stageIdx - 1] : null;

  const [qty, setQty] = useState<number | "">("");

  const move = useMutation({
    mutationFn: async ({ to, note }: { to: Stage; note?: string }) => {
      if (!order) throw new Error("OP não encontrada");
      const partialQty = typeof qty === "number" && qty > 0 ? qty : null;
      const total = Number(order.quantity || 0);
      const isPartial = partialQty != null && partialQty < total;

      const { data: u } = await supabase.auth.getUser();
      const created_by = u.user?.id ?? null;

      if (!navigator.onLine) {
        const q = readQueue();
        q.push({
          id: crypto.randomUUID(),
          order_id: order.id,
          owner_id: order.owner_id,
          from_stage: order.stage,
          to_stage: to,
          quantity: partialQty ?? total,
          is_partial: isPartial,
          note: note ?? null,
          created_by,
          advance_stage: !isPartial,
          ts: Date.now(),
        });
        writeQueue(q);
        setQueueSize(q.length);
        return { queued: true };
      }

      const { error: e1 } = await supabase.from("production_stage_log").insert({
        owner_id: order.owner_id,
        order_id: order.id,
        from_stage: order.stage,
        to_stage: to,
        quantity: partialQty ?? total,
        is_partial: isPartial,
        note: note ?? null,
        created_by,
      } as any);
      if (e1) throw e1;

      if (!isPartial) {
        const { error: e2 } = await supabase
          .from("production_orders")
          .update({ stage: to as any, stage_updated_at: new Date().toISOString() })
          .eq("id", order.id);
        if (e2) throw e2;
      }
      return { queued: false };
    },
    onSuccess: (res, v) => {
      const label = STAGES.find((s) => s.key === v.to)?.label ?? v.to;
      if (res?.queued) toast.success(`Salvo offline → ${label}. Enviará quando reconectar.`);
      else toast.success(`Apontado → ${label}`);
      setQty("");
      qc.invalidateQueries({ queryKey: ["apontar", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-[80vh] grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">OP não encontrada.</p>
        <Link to="/lotes" className="text-primary text-sm">
          Voltar
        </Link>
      </div>
    );
  }

  const late =
    order.due_date &&
    new Date(order.due_date).getTime() < Date.now() &&
    order.stage !== "entregue";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/lotes" className="p-2 -ml-2 rounded-md hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Apontar produção
          </div>
          <div className="text-base font-semibold truncate">{order.code}</div>
        </div>
        {late && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
            <AlertTriangle className="size-3" /> Atrasada
          </span>
        )}
      </header>

      {(!online || queueSize > 0) && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between gap-2 border-b ${
            online
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {online ? <CloudUpload className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online
              ? `${queueSize} apontamento(s) na fila para enviar`
              : "Sem conexão — apontamentos serão salvos e enviados ao reconectar"}
          </span>
          {online && queueSize > 0 && (
            <button
              onClick={async () => {
                const r = await flushQueue();
                setQueueSize(readQueue().length);
                if (r.ok) toast.success(`${r.ok} enviado(s)`);
                if (r.fail) toast.error(`${r.fail} falharam`);
                qc.invalidateQueries({ queryKey: ["apontar", id] });
              }}
              className="underline font-medium"
            >
              Sincronizar
            </button>
          )}
        </div>
      )}

      <main className="px-4 py-4 space-y-5 max-w-xl mx-auto">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            {order.products?.image_url ? (
              <img
                src={order.products.image_url}
                alt=""
                className="size-16 rounded-lg object-cover bg-muted"
              />
            ) : (
              <div className="size-16 rounded-lg bg-muted grid place-items-center text-muted-foreground">
                <Package className="size-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">{order.products?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {order.products?.sku ?? ""}
                {order.suppliers?.name ? ` · ${order.suppliers.name}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                Lote {order.batch_code ?? "—"} · {order.quantity} pç
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Etapa atual
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold">
              {STAGES.find((s) => s.key === order.stage)?.label ?? order.stage}
            </div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="size-3" /> {relTime(order.stage_updated_at)}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground">
            Quantidade (opcional — em branco = total)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(0, (typeof q === "number" ? q : 0) - 1))}
              className="size-12 rounded-lg border border-border text-2xl"
            >
              −
            </button>
            <input
              inputMode="numeric"
              value={qty}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setQty(v === "" ? "" : Number(v));
              }}
              placeholder={`${order.quantity}`}
              className="flex-1 h-12 rounded-lg border border-border bg-background text-center text-xl tabular-nums"
            />
            <button
              type="button"
              onClick={() => setQty((q) => (typeof q === "number" ? q : 0) + 1)}
              className="size-12 rounded-lg border border-border text-2xl"
            >
              +
            </button>
          </div>
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className="flex-1 h-9 rounded-md border border-border text-sm hover:bg-muted"
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {nextStage && (
            <button
              disabled={move.isPending}
              onClick={() => move.mutate({ to: nextStage.key })}
              className="w-full h-16 rounded-xl bg-primary text-primary-foreground font-semibold text-lg inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <ArrowRight className="size-5" /> Avançar para {nextStage.label}
            </button>
          )}
          {!nextStage && (
            <button
              disabled={move.isPending}
              onClick={() => move.mutate({ to: "entregue" })}
              className="w-full h-16 rounded-xl bg-success text-success-foreground font-semibold text-lg inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="size-5" /> Concluir
            </button>
          )}
          {prevStage && (
            <button
              disabled={move.isPending}
              onClick={() => move.mutate({ to: prevStage.key, note: "Retorno" })}
              className="w-full h-12 rounded-xl border border-border text-muted-foreground hover:bg-muted inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="size-4" /> Retornar para {prevStage.label}
            </button>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground text-center">
          Apontamento parcial: digite uma quantidade menor que {order.quantity}. A OP só avança
          quando todas as peças passarem.
        </p>
      </main>
    </div>
  );
}
