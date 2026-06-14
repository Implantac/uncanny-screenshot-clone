import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { Factory, Plus, Trash2, Pencil, Download, FileText, LayoutGrid, GanttChart, Table as TableIcon, AlertTriangle, CheckCircle2, Clock, TrendingUp, Search, Flag, Workflow } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { exportToPdf } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/pcp")({
  head: () => ({ meta: [{ title: "PCP · USE MODA OS" }, { name: "description", content: "Ordens de produção." }] }),
  component: PCP,
});

type Status = "aguardando" | "em_producao" | "concluida" | "atrasada" | "cancelada";
type Stage = "cad" | "corte" | "costura" | "acabamento" | "qualidade" | "expedicao" | "entregue";
type Order = {
  id: string; owner_id: string; product_id: string | null; supplier_id: string | null;
  code: string; quantity: number; progress: number; due_date: string | null;
  status: Status; stage: Stage | null; priority: number; notes: string | null; created_at: string;
};
type Ref = { id: string; name: string };


const LABEL: Record<Status, string> = {
  aguardando: "Aguardando", em_producao: "Em produção", concluida: "Concluída", atrasada: "Atrasada", cancelada: "Cancelada",
};
const COLOR: Record<Status, string> = {
  aguardando: "bg-muted text-muted-foreground",
  em_producao: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  concluida: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  atrasada: "bg-destructive/20 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground",
};
const STAGE_LABEL: Record<Stage, string> = {
  cad: "CAD", corte: "Corte", costura: "Costura", acabamento: "Acabamento", qualidade: "Qualidade", expedicao: "Expedição", entregue: "Entregue",
};
const PRIORITY_TONE: Record<number, string> = {
  1: "bg-destructive/15 text-destructive border-destructive/30",
  2: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  3: "bg-muted text-muted-foreground border-border",
  4: "bg-muted text-muted-foreground border-border",
  5: "bg-muted text-muted-foreground border-border",
};
const PRIORITY_LABEL: Record<number, string> = { 1: "P1 Urgente", 2: "P2 Alta", 3: "P3 Normal", 4: "P4 Baixa", 5: "P5 Backlog" };


function PCP() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("production_orders", ["production_orders"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [form, setForm] = useState({
    code: "", product_id: "", supplier_id: "", quantity: 0, progress: 0,
    due_date: "", status: "aguardando" as Status, notes: "",
  });


  const { data: items = [], isLoading } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name").order("name");
      if (error) throw error;
      return data as Ref[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
      if (error) throw error;
      return data as Ref[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!form.code.trim()) throw new Error("Código obrigatório");
      const payload = {
        owner_id: user.id,
        code: form.code.trim(),
        product_id: form.product_id || null,
        supplier_id: form.supplier_id || null,
        quantity: Number(form.quantity) || 0,
        progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
        due_date: form.due_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("production_orders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("production_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success(editing ? "Ordem atualizada" : "Ordem criada");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production_orders"] }); toast.success("Removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const progress = status === "concluida" ? 100 : status === "aguardando" ? 0 : undefined;
      const payload: any = { status };
      if (progress !== undefined) payload.progress = progress;
      const { error } = await supabase.from("production_orders").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production_orders"] }); toast.success("Status atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [overSt, setOverSt] = useState<Status | null>(null);

  function reset() {
    setOpen(false); setEditing(null);
    setForm({ code: "", product_id: "", supplier_id: "", quantity: 0, progress: 0, due_date: "", status: "aguardando", notes: "" });
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      code: o.code, product_id: o.product_id ?? "", supplier_id: o.supplier_id ?? "",
      quantity: o.quantity, progress: o.progress, due_date: o.due_date ?? "",
      status: o.status, notes: o.notes ?? "",
    });
    setOpen(true);
  }

  const productName = (id: string | null) => products.find(p => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterPriority !== "all" && String(o.priority ?? 3) !== filterPriority) return false;
      if (filterSupplier !== "all" && o.supplier_id !== filterSupplier) return false;
      if (q) {
        const hay = `${o.code} ${productName(o.product_id)} ${supplierName(o.supplier_id)} ${o.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterStatus, filterPriority, filterSupplier, products, suppliers]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const inProd = filtered.filter(i => i.status === "em_producao").length;
    const late = filtered.filter(i => i.status === "atrasada").length;
    const done = filtered.filter(i => i.status === "concluida").length;
    const avg = total ? Math.round(filtered.reduce((s, i) => s + i.progress, 0) / total) : 0;
    const totalQty = filtered.reduce((s, i) => s + (i.quantity || 0), 0);
    return { total, inProd, late, done, avg, totalQty };
  }, [filtered]);

  const byStatus = useMemo(() => {
    const groups: Record<Status, Order[]> = { aguardando: [], em_producao: [], atrasada: [], concluida: [], cancelada: [] };
    for (const o of filtered) groups[o.status].push(o);
    return groups;
  }, [filtered]);

  const timeline = useMemo(() => {
    const dated = filtered.filter(i => i.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
    if (!dated.length) return { rows: [] as Order[], min: null as Date | null, max: null as Date | null, days: 0 };
    const min = new Date(dated[0].due_date!);
    const max = new Date(dated[dated.length - 1].due_date!);
    const start = new Date(Math.min(min.getTime(), Date.now()));
    const end = new Date(Math.max(max.getTime(), Date.now() + 7 * 86400000));
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    return { rows: dated, min: start, max: end, days };
  }, [filtered]);


  const KpiCard = ({ icon: Icon, label, value, accent }: { icon: typeof Factory; label: string; value: string | number; accent?: string }) => (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );

  const Card = ({ o }: { o: Order }) => {
    const canDrag = user?.id === o.owner_id;
    const d = o.due_date ? Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 86400000) : null;
    const overdue = d !== null && d < 0 && o.status !== "concluida";
    return (
      <div
        draggable={canDrag}
        onDragStart={(e) => { if (!canDrag) { e.preventDefault(); return; } setDragId(o.id); e.dataTransfer.setData("text/plain", o.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => setDragId(null)}
        onClick={() => canDrag && openEdit(o)}
        className={`w-full text-left rounded-lg border bg-card hover:bg-muted/30 transition p-3 space-y-2 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === o.id ? "opacity-50" : ""} ${overdue ? "border-destructive/60" : "border-border"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{o.code}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[o.priority ?? 3]}`}>{PRIORITY_LABEL[o.priority ?? 3]}</span>
        </div>
        <div className="text-sm font-medium truncate">{productName(o.product_id)}</div>
        <div className="text-xs text-muted-foreground truncate">{supplierName(o.supplier_id)} · {o.quantity} pç</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{o.progress}%</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {o.stage ? <Badge variant="outline" className="text-[9px] px-1 py-0">{STAGE_LABEL[o.stage]}</Badge> : <span />}
          {o.due_date && <span className={overdue ? "text-destructive font-medium" : ""}>{overdue ? `${Math.abs(d!)}d atrasada` : d === 0 ? "hoje" : `${d}d`}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center"><Factory className="size-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold">PCP & Produção</h1>
            <p className="text-sm text-muted-foreground">Quadro, cronograma e ordens em tempo real</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/pcp-kanban"><Workflow className="size-4 mr-2" />Setores</Link></Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("ordens-producao", filtered.map((o) => ({ ...o, status: LABEL[o.status], stage: o.stage ? STAGE_LABEL[o.stage] : "" })), [
            { key: "code", label: "Código" }, { key: "quantity", label: "Quantidade" },
            { key: "progress", label: "Progresso %" }, { key: "due_date", label: "Prazo" },
            { key: "status", label: "Status" }, { key: "stage", label: "Setor" }, { key: "priority", label: "Prioridade" }, { key: "notes", label: "Observações" },
          ])} disabled={!filtered.length}><Download className="size-4 mr-2" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportToPdf("ordens-producao", "Ordens de Produção", filtered.map((o) => ({ ...o, status: LABEL[o.status] })), [
            { key: "code", label: "Código" }, { key: "quantity", label: "Qtd" },
            { key: "progress", label: "%" }, { key: "due_date", label: "Prazo" },
            { key: "status", label: "Status" },
          ])} disabled={!filtered.length}><FileText className="size-4 mr-2" />PDF</Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />Nova OP</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Factory} label="Ordens" value={kpis.total} />
        <KpiCard icon={Clock} label="Em produção" value={kpis.inProd} accent="text-blue-400" />
        <KpiCard icon={AlertTriangle} label="Atrasadas" value={kpis.late} accent="text-destructive" />
        <KpiCard icon={CheckCircle2} label="Concluídas" value={kpis.done} accent="text-emerald-400" />
        <KpiCard icon={TrendingUp} label="Progresso médio" value={`${kpis.avg}%`} accent="text-primary" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/50 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar código, produto, facção, notas…" className="pl-8" />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(LABEL) as Status[]).map((s) => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as any)}>
          <SelectTrigger className="w-[140px]"><Flag className="size-4 mr-1" /><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {[1, 2, 3, 4, 5].map((p) => <SelectItem key={p} value={String(p)}>{PRIORITY_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Facção" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas facções</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "all" || filterPriority !== "all" || filterSupplier !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterSupplier("all"); }}>Limpar</Button>
        )}
      </div>


      {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
        <Tabs defaultValue="kanban" className="space-y-4">
          <TabsList>
            <TabsTrigger value="kanban"><LayoutGrid className="size-4 mr-2" />Quadro</TabsTrigger>
            <TabsTrigger value="gantt"><GanttChart className="size-4 mr-2" />Cronograma</TabsTrigger>
            <TabsTrigger value="table"><TableIcon className="size-4 mr-2" />Tabela</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <p className="text-xs text-muted-foreground mb-3">Arraste as ordens entre as colunas para mudar o status.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {(Object.keys(LABEL) as Status[]).map(st => {
                const isOver = overSt === st;
                return (
                  <div
                    key={st}
                    onDragOver={(e) => { e.preventDefault(); setOverSt(st); }}
                    onDragLeave={() => setOverSt((s) => (s === st ? null : s))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || dragId;
                      setOverSt(null); setDragId(null);
                      if (id) {
                        const target = items.find(i => i.id === id);
                        if (target && target.status !== st) moveStatus.mutate({ id, status: st });
                      }
                    }}
                    className={`rounded-xl border p-3 space-y-2 min-h-[200px] transition-colors ${isOver ? "border-primary bg-primary/10" : "border-border bg-muted/10"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={COLOR[st]}>{LABEL[st]}</Badge>
                      <span className="text-xs text-muted-foreground">{byStatus[st].length}</span>
                    </div>
                    {byStatus[st].map(o => <Card key={o.id} o={o} />)}
                    {!byStatus[st].length && <p className="text-xs text-muted-foreground/60 text-center py-6">vazio</p>}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="gantt">
            <div className="rounded-xl border border-border overflow-hidden">
              {timeline.rows.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">Defina prazos nas ordens para visualizar o cronograma.</p>
              ) : (
                <div className="divide-y divide-border">
                  <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex justify-between">
                    <span>{timeline.min?.toLocaleDateString("pt-BR")}</span>
                    <span>{timeline.days} dias</span>
                    <span>{timeline.max?.toLocaleDateString("pt-BR")}</span>
                  </div>
                  {timeline.rows.map(o => {
                    const due = new Date(o.due_date!).getTime();
                    const start = timeline.min!.getTime();
                    const end = timeline.max!.getTime();
                    const pos = ((due - start) / (end - start)) * 100;
                    const created = new Date(o.created_at).getTime();
                    const left = Math.max(0, Math.min(100, ((Math.max(created, start) - start) / (end - start)) * 100));
                    const width = Math.max(2, Math.min(100 - left, Math.max(0, pos - left)));
                    return (
                      <div key={o.id} className="px-4 py-3 grid grid-cols-[180px_1fr_80px] gap-3 items-center hover:bg-muted/20">
                        <div className="truncate">
                          <div className="font-mono text-xs text-muted-foreground">{o.code}</div>
                          <div className="text-sm truncate">{productName(o.product_id)}</div>
                        </div>
                        <div className="relative h-6 bg-muted/30 rounded">
                          <div
                            className={`absolute top-0 bottom-0 rounded ${o.status === "atrasada" ? "bg-destructive/60" : o.status === "concluida" ? "bg-emerald-500/60" : "bg-primary/60"}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
                            style={{ left: `${pos}%` }}
                            title={o.due_date ?? ""}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground text-right">{o.due_date}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">OP</th>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-left px-4 py-3">Facção</th>
                    <th className="text-right px-4 py-3">Qtd</th>
                    <th className="text-left px-4 py-3">Progresso</th>
                    <th className="text-left px-4 py-3">Setor</th>
                    <th className="text-left px-4 py-3">Prio</th>
                    <th className="text-left px-4 py-3">Prazo</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                      <td className="px-4 py-3">{productName(o.product_id)}</td>
                      <td className="px-4 py-3">{supplierName(o.supplier_id)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.quantity}</td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{o.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{o.stage ? STAGE_LABEL[o.stage] : "—"}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[o.priority ?? 3]}`}>P{o.priority ?? 3}</span></td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{o.due_date ?? "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={COLOR[o.status]}>{LABEL[o.status]}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {user?.id === o.owner_id && (
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(o)}><Pencil className="size-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)}><Trash2 className="size-4" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Nenhuma ordem encontrada</td></tr>}
                </tbody>

              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar OP" : "Nova OP"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="OP-001" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Produto</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Facção</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              <div><Label>Progresso (%)</Label><Input type="number" min={0} max={100} value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })} /></div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
