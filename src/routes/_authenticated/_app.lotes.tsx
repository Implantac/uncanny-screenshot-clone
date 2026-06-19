import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Plus,
  Factory,
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  ArrowRightCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/_app/lotes")({
  head: () => ({
    meta: [
      { title: "Lotes & Rastreabilidade · USE MODA PLM" },
      {
        name: "description",
        content: "Lotes de produção com vínculo às OPs e histórico de estágios.",
      },
    ],
  }),
  component: LotesPage,
});

type Batch = {
  id: string;
  code: string;
  status: "planejado" | "em_producao" | "finalizado" | "cancelado";
  planned_qty: number;
  produced_qty: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
};

type OrderRef = {
  id: string;
  code: string;
  batch_code: string | null;
  stage: string;
  status: string;
  quantity: number;
  progress: number;
  due_date: string | null;
};

type StageLog = {
  id: string;
  order_id: string;
  from_stage: string | null;
  to_stage: string;
  quantity: number;
  note: string | null;
  is_partial: boolean;
  created_at: string;
};

const STATUS_META: Record<Batch["status"], { label: string; tone: string; icon: typeof Clock }> = {
  planejado: {
    label: "Planejado",
    tone: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
  em_producao: {
    label: "Em produção",
    tone: "bg-primary/15 text-primary border-primary/30",
    icon: Factory,
  },
  finalizado: {
    label: "Finalizado",
    tone: "bg-success/15 text-success border-success/30",
    icon: CheckCircle2,
  },
  cancelado: {
    label: "Cancelado",
    tone: "bg-destructive/15 text-destructive border-destructive/30",
    icon: AlertTriangle,
  },
};

function LotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("production_batches", ["batches"]);
  useRealtime("production_orders", ["batch-orders"]);
  useRealtime("production_stage_log", ["batch-logs"]);

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [passOrder, setPassOrder] = useState<OrderRef | null>(null);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_batches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Batch[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["batch-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, code, batch_code, stage, status, quantity, progress, due_date")
        .not("batch_code", "is", null);
      if (error) throw error;
      return data as OrderRef[];
    },
  });

  const selected = useMemo(
    () => batches.find((b) => b.id === selectedId) ?? batches[0] ?? null,
    [batches, selectedId],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return batches;
    return batches.filter(
      (b) => b.code.toLowerCase().includes(term) || (b.notes ?? "").toLowerCase().includes(term),
    );
  }, [batches, q]);

  const linkedOrders = useMemo(
    () => (selected ? orders.filter((o) => o.batch_code === selected.code) : []),
    [orders, selected],
  );

  const { data: logs = [] } = useQuery({
    queryKey: ["batch-logs", linkedOrders.map((o) => o.id).join(",")],
    enabled: linkedOrders.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stage_log")
        .select("id, order_id, from_stage, to_stage, quantity, note, is_partial, created_at")
        .in(
          "order_id",
          linkedOrders.map((o) => o.id),
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StageLog[];
    },
  });

  const kpis = useMemo(() => {
    const total = batches.length;
    const active = batches.filter((b) => b.status === "em_producao").length;
    const planned = batches.reduce((a, b) => a + (b.planned_qty ?? 0), 0);
    const produced = batches.reduce((a, b) => a + (b.produced_qty ?? 0), 0);
    return {
      total,
      active,
      planned,
      produced,
      eff: planned > 0 ? Math.round((produced / planned) * 100) : 0,
    };
  }, [batches]);

  const selectedHealth = useMemo(() => {
    if (!selected) return null;
    const late = linkedOrders.filter(
      (o) => o.due_date && new Date(o.due_date).getTime() < Date.now() && o.status !== "concluida",
    ).length;
    const avgProgress = linkedOrders.length
      ? Math.round(linkedOrders.reduce((s, o) => s + o.progress, 0) / linkedOrders.length)
      : 0;
    const lastMove = logs[0]?.created_at
      ? new Date(logs[0].created_at).toLocaleDateString("pt-BR")
      : "sem passagem";
    const risk =
      late > 0
        ? "alto"
        : avgProgress < 40 && selected.status === "em_producao"
          ? "atenção"
          : "controlado";
    return { late, avgProgress, lastMove, risk };
  }, [selected, linkedOrders, logs]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Lote removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(b: Batch) {
    setEditing(b);
    setOpen(true);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
            PCP · Produção
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Boxes className="size-6 text-primary" /> Lotes & Rastreabilidade
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupe ordens de produção em lotes e visualize o histórico completo de estágios.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Novo lote
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Lotes totais" value={String(kpis.total)} />
        <Kpi label="Em produção" value={String(kpis.active)} />
        <Kpi label="Peças planejadas" value={kpis.planned.toLocaleString("pt-BR")} />
        <Kpi label="Eficiência média" value={`${kpis.eff}%`} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : batches.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Boxes className="size-10 text-primary mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Nenhum lote criado</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Crie um lote para agrupar OPs e rastrear produção ponta a ponta.
          </p>
          <Button onClick={openCreate}>Criar primeiro lote</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4">
          <section className="glass rounded-xl p-3 sm:p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar lote…"
                className="pl-8 h-9"
              />
            </div>
            <div className="space-y-2">
              {filtered.map((b) => {
                const active = selected?.id === b.id;
                const meta = STATUS_META[b.status];
                const pct =
                  b.planned_qty > 0 ? Math.round((b.produced_qty / b.planned_qty) * 100) : 0;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${active ? "border-primary/40 bg-primary/10" : "border-border bg-background/30 hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{b.code}</div>
                        <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                          {b.produced_qty}/{b.planned_qty} pç
                        </div>
                      </div>
                      <Badge variant="outline" className={meta.tone}>
                        {meta.label}
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-1.5 mt-3" />
                  </button>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="space-y-4">
              <div className="glass rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">{selected.code}</h2>
                      <Badge variant="outline" className={STATUS_META[selected.status].tone}>
                        {STATUS_META[selected.status].label}
                      </Badge>
                    </div>
                    {selected.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{selected.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to="/lote/$id" params={{ id: selected.id }}>
                      <Button size="sm">Abrir lote</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Remover lote?")) deleteMut.mutate(selected.id);
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Metric label="Planejado" value={`${selected.planned_qty} pç`} />
                  <Metric
                    label="Completo pelas OPs"
                    value={`${selectedHealth?.avgProgress ?? 0}%`}
                  />
                  <Metric label="Risco" value={selectedHealth?.risk ?? "—"} />
                  <Metric label="Última passagem" value={selectedHealth?.lastMove ?? "—"} />
                </div>
                {selectedHealth && (
                  <div
                    className={`mt-4 rounded-lg border p-3 text-sm ${selectedHealth.late ? "border-destructive/40 bg-destructive/5" : "border-border bg-background/30"}`}
                  >
                    {selectedHealth.late
                      ? `${selectedHealth.late} OP(s) do lote estão atrasadas. Abra o lote e faça a passagem das etapas críticas primeiro.`
                      : "Lote sem atraso crítico. Continue acompanhando a última passagem para evitar fila invisível."}
                  </div>
                )}
              </div>

              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Factory className="size-4 text-primary" /> Ordens vinculadas
                  </div>
                  <span className="text-xs text-muted-foreground">{linkedOrders.length} OPs</span>
                </div>
                {linkedOrders.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left py-2">OP</th>
                          <th className="text-left">Estágio</th>
                          <th className="text-right">Qtd</th>
                          <th className="text-right">Progresso</th>
                          <th className="text-left pl-3">Prazo</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {linkedOrders.map((o) => (
                          <tr key={o.id} className="border-b border-border/40 last:border-0">
                            <td className="py-2 font-medium">{o.code}</td>
                            <td className="capitalize">{o.stage}</td>
                            <td className="text-right tabular-nums">{o.quantity}</td>
                            <td className="text-right tabular-nums">{o.progress}%</td>
                            <td className="pl-3 text-muted-foreground">
                              {o.due_date ? new Date(o.due_date).toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="pl-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-7"
                                onClick={() => setPassOrder(o)}
                              >
                                <ArrowRightCircle className="size-3.5" /> Passagem
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma OP vinculada. Defina{" "}
                    <code className="px-1 rounded bg-muted">batch_code = {selected.code}</code> em
                    uma ordem de produção.
                  </div>
                )}
              </div>

              <div className="glass rounded-xl p-5">
                <div className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <History className="size-4 text-primary" /> Histórico de rastreabilidade
                </div>
                {logs.length ? (
                  <ol className="space-y-3">
                    {logs.map((l) => {
                      const op = linkedOrders.find((o) => o.id === l.order_id);
                      return (
                        <li key={l.id} className="flex gap-3 text-sm">
                          <div className="size-7 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center">
                            <History className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">
                              {op?.code ?? "OP"} · {l.from_stage ?? "—"} →{" "}
                              <span className="text-primary">{l.to_stage}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {l.quantity} pç {l.is_partial && "(parcial)"} ·{" "}
                              {new Date(l.created_at).toLocaleString("pt-BR")}
                              {l.note && <> · {l.note}</>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    Sem eventos registrados.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <BatchDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
      <PassageDialog order={passOrder} onClose={() => setPassOrder(null)} userId={user?.id} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-1">{value}</div>
    </div>
  );
}

function BatchDialog({
  open,
  onOpenChange,
  editing,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Batch | null;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Batch["status"]>("planejado");
  const [plannedQty, setPlannedQty] = useState(0);
  const [producedQty, setProducedQty] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setCode(editing.code);
      setStatus(editing.status);
      setPlannedQty(editing.planned_qty);
      setProducedQty(editing.produced_qty);
      setStartDate(editing.start_date ?? "");
      setEndDate(editing.end_date ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setCode(`L-${Date.now().toString().slice(-6)}`);
      setStatus("planejado");
      setPlannedQty(0);
      setProducedQty(0);
      setStartDate("");
      setEndDate("");
      setNotes("");
    }
  }, [editing, open]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        code,
        status,
        planned_qty: plannedQty,
        produced_qty: producedQty,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("production_batches")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("production_batches")
          .insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success(editing ? "Lote atualizado" : "Lote criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lote" : "Novo lote"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label>Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Batch["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Planejado</Label>
              <Input
                type="number"
                min={0}
                value={plannedQty}
                onChange={(e) => setPlannedQty(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Produzido</Label>
              <Input
                type="number"
                min={0}
                value={producedQty}
                onChange={(e) => setProducedQty(Number(e.target.value))}
              />
            </div>
            <div />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PassageDialog({
  order,
  onClose,
  userId,
}: {
  order: OrderRef | null;
  onClose: () => void;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"integral" | "parcial">("parcial");
  const [lineType, setLineType] = useState<"primeira" | "segunda_linha">("primeira");
  const [toStage, setToStage] = useState("");
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!order) return;
    setKind("parcial");
    setLineType("primeira");
    setToStage("");
    setQty(order.quantity);
    setNote("");
  }, [order]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId || !order) throw new Error("Sessão expirada");
      if (!toStage) throw new Error("Informe o estágio de destino");
      if (qty <= 0) throw new Error("Quantidade deve ser maior que zero");
      const code = `OS-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from("service_orders").insert({
        owner_id: userId,
        production_order_id: order.id,
        code,
        from_stage: order.stage,
        to_stage: toStage,
        kind,
        line_type: lineType,
        quantity: qty,
        qty_received: qty,
        status: "recebida",
        notes: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch-orders"] });
      qc.invalidateQueries({ queryKey: ["batch-logs"] });
      toast.success("Passagem registrada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar passagem · {order?.code}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "integral" | "parcial")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Linha da peça</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={lineType === "primeira" ? "default" : "outline"}
                onClick={() => setLineType("primeira")}
              >
                1ª linha
              </Button>
              <Button
                type="button"
                variant={lineType === "segunda_linha" ? "default" : "outline"}
                onClick={() => setLineType("segunda_linha")}
              >
                2ª linha
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>De</Label>
              <Input value={order?.stage ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Para</Label>
              <Input
                value={toStage}
                onChange={(e) => setToStage(e.target.value)}
                placeholder="costura, acabamento…"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
