import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import {
  Factory,
  Plus,
  Trash2,
  Pencil,
  Download,
  FileText,
  LayoutGrid,
  GanttChart,
  Table as TableIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Flag,
  Workflow,
  History,
  Package,
  Boxes,
  ImageIcon,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { exportToPdf } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const STATUS_VALS = ["aguardando", "em_producao", "concluida", "atrasada", "cancelada"] as const;
const pcpSearchSchema = z.object({
  q: fallback(z.string().trim().max(80), "").default(""),
  status: fallback(z.enum(["all", ...STATUS_VALS]), "all").default("all"),
  priority: fallback(z.enum(["all", "1", "2", "3", "4", "5"]), "all").default("all"),
  supplier: fallback(z.string().trim().max(80), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/_app/pcp")({
  validateSearch: zodValidator(pcpSearchSchema),
  beforeLoad: () => {
    throw redirect({ to: "/pcp-kanban" });
  },
  head: () => ({
    meta: [{ title: "PCP · USE MODA OS" }, { name: "description", content: "Ordens de produção." }],
  }),
  component: PCP,
});

type Status = "aguardando" | "em_producao" | "concluida" | "atrasada" | "cancelada";
type Stage = "cad" | "corte" | "costura" | "acabamento" | "qualidade" | "expedicao" | "entregue";
type Order = {
  id: string;
  owner_id: string;
  product_id: string | null;
  supplier_id: string | null;
  code: string;
  quantity: number;
  progress: number;
  due_date: string | null;
  status: Status;
  stage: Stage | null;
  priority: number;
  notes: string | null;
  created_at: string;
  batch_code: string | null;
};
type Ref = { id: string; name: string };
type ProductRef = { id: string; name: string; image_url: string | null; sku: string | null };

const LABEL: Record<Status, string> = {
  aguardando: "Aguardando",
  em_producao: "Em produção",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};
const COLOR: Record<Status, string> = {
  aguardando: "bg-muted text-muted-foreground",
  em_producao: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  concluida: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  atrasada: "bg-destructive/20 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground",
};
const STAGE_LABEL: Record<Stage, string> = {
  cad: "CAD",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  qualidade: "Qualidade",
  expedicao: "Expedição",
  entregue: "Entregue",
};
const PRIORITY_TONE: Record<number, string> = {
  1: "bg-destructive/15 text-destructive border-destructive/30",
  2: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  3: "bg-muted text-muted-foreground border-border",
  4: "bg-muted text-muted-foreground border-border",
  5: "bg-muted text-muted-foreground border-border",
};
const PRIORITY_LABEL: Record<number, string> = {
  1: "P1 Urgente",
  2: "P2 Alta",
  3: "P3 Normal",
  4: "P4 Baixa",
  5: "P5 Backlog",
};

function PCP() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("production_orders", ["production_orders"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const searchParams = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    q: search,
    status: filterStatus,
    priority: filterPriority,
    supplier: filterSupplier,
  } = searchParams;
  const patch = (p: Partial<typeof searchParams>) =>
    navigate({ search: (prev: typeof searchParams) => ({ ...prev, ...p }), replace: true });
  const setSearch = (v: string) => patch({ q: v });
  const setFilterStatus = (v: typeof searchParams.status) => patch({ status: v });
  const setFilterPriority = (v: typeof searchParams.priority) => patch({ priority: v });
  const setFilterSupplier = (v: string) => patch({ supplier: v });
  const [form, setForm] = useState({
    code: "",
    product_id: "",
    supplier_id: "",
    quantity: 0,
    progress: 0,
    due_date: "",
    status: "aguardando" as Status,
    stage: "cad" as Stage,
    priority: 3,
    notes: "",
    batch_code: "",
  });
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [batchView, setBatchView] = useState<{ code: string; stage: Stage | null } | null>(null);

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-ref"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,image_url,sku")
        .order("name");
      if (error) throw error;
      return data as ProductRef[];
    },
  });

  const { data: suppliersData } = useQuery({
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
        stage: form.stage,
        priority: Number(form.priority) || 3,
        notes: form.notes.trim() || null,
        batch_code: form.batch_code.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("production_orders")
          .update(payload)
          .eq("id", editing.id);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Removida");
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [overSt, setOverSt] = useState<Status | null>(null);

  function reset() {
    setOpen(false);
    setEditing(null);
    setForm({
      code: "",
      product_id: "",
      supplier_id: "",
      quantity: 0,
      progress: 0,
      due_date: "",
      status: "aguardando",
      stage: "cad",
      priority: 3,
      notes: "",
      batch_code: "",
    });
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      code: o.code,
      product_id: o.product_id ?? "",
      supplier_id: o.supplier_id ?? "",
      quantity: o.quantity,
      progress: o.progress,
      due_date: o.due_date ?? "",
      status: o.status,
      stage: (o.stage ?? "cad") as Stage,
      priority: o.priority ?? 3,
      notes: o.notes ?? "",
      batch_code: o.batch_code ?? "",
    });
    setOpen(true);
  }

  const items = useMemo(() => itemsData ?? [], [itemsData]);
  const products = useMemo(() => productsData ?? [], [productsData]);
  const suppliers = useMemo(() => suppliersData ?? [], [suppliersData]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const productName = (id: string | null) => productById.get(id ?? "")?.name ?? "—";
  const productInfo = (id: string | null) => productById.get(id ?? "") ?? null;
  const supplierName = (id: string | null) => supplierById.get(id ?? "")?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterPriority !== "all" && String(o.priority ?? 3) !== filterPriority) return false;
      if (filterSupplier !== "all" && o.supplier_id !== filterSupplier) return false;
      if (q) {
        const p = productById.get(o.product_id ?? "");
        const hay =
          `${o.code} ${p?.name ?? ""} ${p?.sku ?? ""} ${supplierById.get(o.supplier_id ?? "")?.name ?? "—"} ${o.notes ?? ""} ${o.batch_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterStatus, filterPriority, filterSupplier, productById, supplierById]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const inProd = filtered.filter((i) => i.status === "em_producao").length;
    const late = filtered.filter((i) => i.status === "atrasada").length;
    const done = filtered.filter((i) => i.status === "concluida").length;
    const avg = total ? Math.round(filtered.reduce((s, i) => s + i.progress, 0) / total) : 0;
    const totalQty = filtered.reduce((s, i) => s + (i.quantity || 0), 0);
    return { total, inProd, late, done, avg, totalQty };
  }, [filtered]);

  const byStatus = useMemo(() => {
    const groups: Record<Status, Order[]> = {
      aguardando: [],
      em_producao: [],
      atrasada: [],
      concluida: [],
      cancelada: [],
    };
    for (const o of filtered) groups[o.status].push(o);
    return groups;
  }, [filtered]);

  const timeline = useMemo(() => {
    const dated = filtered
      .filter((i) => i.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
    if (!dated.length)
      return { rows: [] as Order[], min: null as Date | null, max: null as Date | null, days: 0 };
    const min = new Date(dated[0].due_date!);
    const max = new Date(dated[dated.length - 1].due_date!);
    const start = new Date(Math.min(min.getTime(), Date.now()));
    const end = new Date(Math.max(max.getTime(), Date.now() + 7 * 86400000));
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    return { rows: dated, min: start, max: end, days };
  }, [filtered]);

  const KpiCard = ({
    icon: Icon,
    label,
    value,
    accent,
  }: {
    icon: typeof Factory;
    label: string;
    value: string | number;
    accent?: string;
  }) => (
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
    const d = o.due_date
      ? Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 86400000)
      : null;
    const overdue = d !== null && d < 0 && o.status !== "concluida";
    const p = productInfo(o.product_id);
    return (
      <div
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) {
            e.preventDefault();
            return;
          }
          setDragId(o.id);
          e.dataTransfer.setData("text/plain", o.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setDragId(null)}
        onClick={() => canDrag && openEdit(o)}
        className={`w-full text-left rounded-lg border bg-card hover:bg-muted/30 transition p-3 space-y-2 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === o.id ? "opacity-50" : ""} ${overdue ? "border-destructive/60" : "border-border"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{o.code}</span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[o.priority ?? 3]}`}
          >
            {PRIORITY_LABEL[o.priority ?? 3]}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="size-12 rounded-md border border-border bg-muted/40 overflow-hidden shrink-0 grid place-items-center">
            {p?.image_url ? (
              <img
                src={p.image_url}
                alt={p.name}
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon className="size-4 text-muted-foreground/60" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{p?.name ?? "—"}</div>
            <div className="text-[10px] text-muted-foreground truncate font-mono">
              {p?.sku ?? "sem SKU"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {supplierName(o.supplier_id)} · {o.quantity} pç
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{o.progress}%</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1 flex-wrap">
            {o.stage && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                {STAGE_LABEL[o.stage]}
              </Badge>
            )}
            {o.batch_code && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBatchView({ code: o.batch_code!, stage: o.stage });
                }}
                className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                title="Ver referências deste lote"
              >
                <Boxes className="size-2.5" />
                Lote {o.batch_code}
              </button>
            )}
          </div>
          {o.due_date && (
            <span className={overdue ? "text-destructive font-medium" : ""}>
              {overdue ? `${Math.abs(d!)}d atrasada` : d === 0 ? "hoje" : `${d}d`}
            </span>
          )}
        </div>
        {o.product_id && (
          <Link
            to="/ficha-tecnica"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <FileText className="size-3" /> Ficha técnica
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <Factory className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">PCP & Produção</h1>
            <p className="text-sm text-muted-foreground">
              Quadro, cronograma e ordens em tempo real
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/pcp-kanban">
              <Workflow className="size-4 mr-2" />
              Setores
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCsv(
                "ordens-producao",
                filtered.map((o) => ({
                  ...o,
                  status: LABEL[o.status],
                  stage: o.stage ? STAGE_LABEL[o.stage] : "",
                })),
                [
                  { key: "code", label: "Código" },
                  { key: "quantity", label: "Quantidade" },
                  { key: "progress", label: "Progresso %" },
                  { key: "due_date", label: "Prazo" },
                  { key: "status", label: "Status" },
                  { key: "stage", label: "Setor" },
                  { key: "priority", label: "Prioridade" },
                  { key: "notes", label: "Observações" },
                ],
              )
            }
            disabled={!filtered.length}
          >
            <Download className="size-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToPdf(
                "ordens-producao",
                "Ordens de Produção",
                filtered.map((o) => ({ ...o, status: LABEL[o.status] })),
                [
                  { key: "code", label: "Código" },
                  { key: "quantity", label: "Qtd" },
                  { key: "progress", label: "%" },
                  { key: "due_date", label: "Prazo" },
                  { key: "status", label: "Status" },
                ],
              )
            }
            disabled={!filtered.length}
          >
            <FileText className="size-4 mr-2" />
            PDF
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4 mr-2" />
            Nova OP
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Factory} label="Ordens" value={kpis.total} />
        <KpiCard icon={Clock} label="Em produção" value={kpis.inProd} accent="text-blue-400" />
        <KpiCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={kpis.late}
          accent="text-destructive"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Concluídas"
          value={kpis.done}
          accent="text-emerald-400"
        />
        <KpiCard
          icon={TrendingUp}
          label="Progresso médio"
          value={`${kpis.avg}%`}
          accent="text-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/50 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, produto, facção, notas…"
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(LABEL) as Status[]).map((s) => (
              <SelectItem key={s} value={s}>
                {LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as any)}>
          <SelectTrigger className="w-[140px]">
            <Flag className="size-4 mr-1" />
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {[1, 2, 3, 4, 5].map((p) => (
              <SelectItem key={p} value={String(p)}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Facção" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas facções</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search ||
          filterStatus !== "all" ||
          filterPriority !== "all" ||
          filterSupplier !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilterStatus("all");
              setFilterPriority("all");
              setFilterSupplier("all");
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <Tabs defaultValue="kanban" className="space-y-4">
          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="size-4 mr-2" />
              Quadro
            </TabsTrigger>
            <TabsTrigger value="gantt">
              <GanttChart className="size-4 mr-2" />
              Cronograma
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableIcon className="size-4 mr-2" />
              Tabela
            </TabsTrigger>
            <TabsTrigger value="lotes">
              <Boxes className="size-4 mr-2" />
              Lotes
            </TabsTrigger>
            <TabsTrigger value="os">
              <Workflow className="size-4 mr-2" />
              O.S. Terceirizados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <p className="text-xs text-muted-foreground mb-3">
              Arraste as ordens entre as colunas para mudar o status.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {(Object.keys(LABEL) as Status[]).map((st) => {
                const isOver = overSt === st;
                return (
                  <div
                    key={st}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverSt(st);
                    }}
                    onDragLeave={() => setOverSt((s) => (s === st ? null : s))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || dragId;
                      setOverSt(null);
                      setDragId(null);
                      if (id) {
                        const target = items.find((i) => i.id === id);
                        if (target && target.status !== st) moveStatus.mutate({ id, status: st });
                      }
                    }}
                    className={`rounded-xl border p-3 space-y-2 min-h-[200px] transition-colors ${isOver ? "border-primary bg-primary/10" : "border-border bg-muted/10"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={COLOR[st]}>
                        {LABEL[st]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{byStatus[st].length}</span>
                    </div>
                    {byStatus[st].map((o) => (
                      <Card key={o.id} o={o} />
                    ))}
                    {!byStatus[st].length && (
                      <p className="text-xs text-muted-foreground/60 text-center py-6">vazio</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="gantt">
            <div className="rounded-xl border border-border overflow-hidden">
              {timeline.rows.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">
                  Defina prazos nas ordens para visualizar o cronograma.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex justify-between">
                    <span>{timeline.min?.toLocaleDateString("pt-BR")}</span>
                    <span>{timeline.days} dias</span>
                    <span>{timeline.max?.toLocaleDateString("pt-BR")}</span>
                  </div>
                  {timeline.rows.map((o) => {
                    const due = new Date(o.due_date!).getTime();
                    const start = timeline.min!.getTime();
                    const end = timeline.max!.getTime();
                    const pos = ((due - start) / (end - start)) * 100;
                    const created = new Date(o.created_at).getTime();
                    const left = Math.max(
                      0,
                      Math.min(100, ((Math.max(created, start) - start) / (end - start)) * 100),
                    );
                    const width = Math.max(2, Math.min(100 - left, Math.max(0, pos - left)));
                    return (
                      <div
                        key={o.id}
                        className="px-4 py-3 grid grid-cols-[180px_1fr_80px] gap-3 items-center hover:bg-muted/20"
                      >
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
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                      <td className="px-4 py-3">{productName(o.product_id)}</td>
                      <td className="px-4 py-3">{supplierName(o.supplier_id)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.quantity}</td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${o.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {o.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.stage ? STAGE_LABEL[o.stage] : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[o.priority ?? 3]}`}
                        >
                          P{o.priority ?? 3}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {o.due_date ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={COLOR[o.status]}>
                          {LABEL[o.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Histórico de setores"
                            onClick={() => setHistoryOrder(o)}
                          >
                            <History className="size-4" />
                          </Button>
                          {user?.id === o.owner_id && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(o)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhuma ordem encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="lotes">
            <BatchesByStage
              orders={filtered}
              products={products}
              onOpenBatch={(code, stage) => setBatchView({ code, stage })}
            />
          </TabsContent>

          <TabsContent value="os">
            <ServiceOrdersPanel
              orders={items}
              suppliers={suppliers}
              products={products}
              ownerId={user?.id ?? null}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar OP" : "Nova OP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="OP-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Produto</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => setForm({ ...form, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Facção</Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(v) => setForm({ ...form, supplier_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Progresso (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm({ ...form, stage: v as Stage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STAGE_LABEL) as Stage[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {STAGE_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={String(form.priority)}
                  onValueChange={(v) => setForm({ ...form, priority: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lote</Label>
                <Input
                  value={form.batch_code}
                  onChange={(e) => setForm({ ...form, batch_code: e.target.value })}
                  placeholder="LOTE-2026-01"
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StageHistoryDialog order={historyOrder} onClose={() => setHistoryOrder(null)} />
      <BatchDialog
        batch={batchView}
        orders={items}
        products={products}
        suppliers={suppliers}
        onClose={() => setBatchView(null)}
      />
    </div>
  );
}

function StageHistoryDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { data: log = [], isLoading } = useQuery({
    queryKey: ["stage-log", order?.id],
    queryFn: async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from("production_stage_log")
        .select("from_stage, to_stage, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!order,
  });

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Histórico — {order?.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && log.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma passagem de setor registrada.</p>
          )}
          {log.map((l, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {l.from_stage ? STAGE_LABEL[l.from_stage as Stage] : "início"}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant="outline" className="text-xs">
                  {STAGE_LABEL[l.to_stage as Stage]}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {new Date(l.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SOKind = "parcial" | "integral";
type SOStatus = "aberta" | "enviada" | "em_andamento" | "recebida" | "cancelada";
type SOLineType = "primeira" | "segunda_linha";
type ServiceOrder = {
  id: string;
  owner_id: string;
  production_order_id: string;
  supplier_id: string | null;
  code: string;
  from_stage: string | null;
  to_stage: Stage;
  kind: SOKind;
  line_type: SOLineType;
  quantity: number;
  qty_received: number;
  status: SOStatus;
  sent_at: string | null;
  due_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
};

const SO_STATUS_LABEL: Record<SOStatus, string> = {
  aberta: "Aberta",
  enviada: "Enviada",
  em_andamento: "Em andamento",
  recebida: "Recebida",
  cancelada: "Cancelada",
};
const SO_STATUS_TONE: Record<SOStatus, string> = {
  aberta: "bg-muted text-muted-foreground border-border",
  enviada: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  em_andamento: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  recebida: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
};

function ServiceOrdersPanel({
  orders,
  suppliers,
  products,
  ownerId,
}: {
  orders: Order[];
  suppliers: Ref[];
  products: Ref[];
  ownerId: string | null;
}) {
  const qc = useQueryClient();
  useRealtime("service_orders", ["service_orders"]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    production_order_id: "",
    supplier_id: "",
    from_stage: "" as "" | Stage,
    to_stage: "costura" as Stage,
    kind: "integral" as SOKind,
    line_type: "primeira" as SOLineType,
    quantity: 0,
    due_at: "",
    notes: "",
  });

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["service_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceOrder[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!ownerId) throw new Error("Não autenticado");
      if (!form.code.trim()) throw new Error("Código obrigatório");
      if (!form.production_order_id) throw new Error("Selecione a OP");
      const { error } = await supabase.from("service_orders").insert({
        owner_id: ownerId,
        code: form.code.trim(),
        production_order_id: form.production_order_id,
        supplier_id: form.supplier_id || null,
        from_stage: form.from_stage || null,
        to_stage: form.to_stage,
        kind: form.kind,
        line_type: form.line_type,
        quantity: Number(form.quantity) || 0,
        due_at: form.due_at || null,
        notes: form.notes.trim() || null,
        status: "aberta",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_orders"] });
      toast.success("O.S. criada");
      setOpen(false);
      setForm({
        code: "",
        production_order_id: "",
        supplier_id: "",
        from_stage: "",
        to_stage: "costura",
        kind: "integral",
        line_type: "primeira",
        quantity: 0,
        due_at: "",
        notes: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<ServiceOrder> }) => {
      const { error } = await supabase.from("service_orders").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service_orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_orders"] });
      toast.success("Removida");
    },
  });

  const items = useMemo(() => itemsData ?? [], [itemsData]);
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const opName = (id: string) => orderById.get(id)?.code ?? "—";
  const opProduct = (id: string) => {
    const op = orderById.get(id);
    return op ? (productById.get(op.product_id ?? "")?.name ?? "—") : "—";
  };
  const supplierName = (id: string | null) => supplierById.get(id ?? "")?.name ?? "—";

  const kpis = useMemo(
    () => ({
      total: items.length,
      abertas: items.filter((i) => i.status === "aberta" || i.status === "enviada").length,
      andamento: items.filter((i) => i.status === "em_andamento").length,
      recebidas: items.filter((i) => i.status === "recebida").length,
      parciais: items.filter((i) => i.kind === "parcial").length,
      segundaLinha: items.filter((i) => i.line_type === "segunda_linha").length,
      qtyEnviada: items
        .filter((i) => i.status !== "cancelada")
        .reduce((s, i) => s + Number(i.quantity || 0), 0),
      qtyRecebida: items.reduce((s, i) => s + Number(i.qty_received || 0), 0),
    }),
    [items],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ordens de Serviço — Terceirizados</h2>
          <p className="text-xs text-muted-foreground">
            Controle de passagens parciais e integrais para facções. Receber uma O.S. integral
            avança o setor automaticamente.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-2" />
          Nova O.S.
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total O.S.</div>
          <div className="text-xl font-semibold">{kpis.total}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Abertas/Enviadas</div>
          <div className="text-xl font-semibold text-blue-500">{kpis.abertas}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Em andamento</div>
          <div className="text-xl font-semibold text-orange-500">{kpis.andamento}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Parciais / 2ª linha</div>
          <div className="text-xl font-semibold tabular-nums">
            {kpis.parciais} / <span className="text-orange-500">{kpis.segundaLinha}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Pç enviadas / recebidas</div>
          <div className="text-xl font-semibold tabular-nums">
            {kpis.qtyEnviada} / <span className="text-emerald-500">{kpis.qtyRecebida}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">O.S.</th>
              <th className="text-left px-3 py-2">OP / Produto</th>
              <th className="text-left px-3 py-2">Terceirizado</th>
              <th className="text-left px-3 py-2">Setor</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Linha</th>
              <th className="text-right px-3 py-2">Qtd</th>
              <th className="text-right px-3 py-2">Recebida</th>
              <th className="text-left px-3 py-2">Prazo</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  Nenhuma O.S. ainda. Crie a primeira para enviar à facção.
                </td>
              </tr>
            )}
            {items.map((s) => {
              const progress =
                s.quantity > 0
                  ? Math.round((Number(s.qty_received) / Number(s.quantity)) * 100)
                  : 0;
              const overdue =
                s.due_at &&
                s.status !== "recebida" &&
                s.status !== "cancelada" &&
                new Date(s.due_at).getTime() < Date.now();
              return (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-medium">{opName(s.production_order_id)}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {opProduct(s.production_order_id)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{supplierName(s.supplier_id)}</td>
                  <td className="px-3 py-2 text-xs">
                    {s.from_stage ? (
                      <span className="text-muted-foreground">
                        {STAGE_LABEL[s.from_stage as Stage]} →{" "}
                      </span>
                    ) : null}
                    <span className="font-medium">{STAGE_LABEL[s.to_stage]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        s.kind === "parcial"
                          ? "border-orange-500/40 text-orange-500"
                          : "border-emerald-500/40 text-emerald-500"
                      }
                    >
                      {s.kind}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        s.line_type === "segunda_linha"
                          ? "border-orange-500/40 text-orange-500"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {s.line_type === "segunda_linha" ? "2ª linha" : "1ª linha"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <input
                      type="number"
                      min={0}
                      max={s.quantity}
                      value={s.qty_received}
                      onChange={(e) =>
                        patch.mutate({
                          id: s.id,
                          changes: { qty_received: Number(e.target.value) },
                        })
                      }
                      className="w-20 bg-muted/50 border border-border rounded px-2 py-0.5 text-right"
                    />
                    <div className="text-[10px] text-muted-foreground">{progress}%</div>
                  </td>
                  <td
                    className={`px-3 py-2 text-xs tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {s.due_at ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={s.status}
                      onValueChange={(v) =>
                        patch.mutate({ id: s.id, changes: { status: v as SOStatus } })
                      }
                    >
                      <SelectTrigger
                        className={`h-7 text-[11px] border ${SO_STATUS_TONE[s.status]}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SO_STATUS_LABEL) as SOStatus[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {SO_STATUS_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del.mutate(s.id)}
                      disabled={s.owner_id !== ownerId}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="OS-001"
                />
              </div>
              <div>
                <Label>OP *</Label>
                <Select
                  value={form.production_order_id}
                  onValueChange={(v) => setForm({ ...form, production_order_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Terceirizado / Facção</Label>
              <Select
                value={form.supplier_id}
                onValueChange={(v) => setForm({ ...form, supplier_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>De (setor)</Label>
                <Select
                  value={form.from_stage}
                  onValueChange={(v) => setForm({ ...form, from_stage: v as Stage })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STAGE_LABEL) as Stage[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {STAGE_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Para (setor) *</Label>
                <Select
                  value={form.to_stage}
                  onValueChange={(v) => setForm({ ...form, to_stage: v as Stage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STAGE_LABEL) as Stage[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {STAGE_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as SOKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integral">Integral</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Linha da peça</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, line_type: "primeira" })}
                  className={`rounded-md border px-3 py-2 text-sm transition ${form.line_type === "primeira" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                >
                  1ª linha
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, line_type: "segunda_linha" })}
                  className={`rounded-md border px-3 py-2 text-sm transition ${form.line_type === "segunda_linha" ? "border-orange-500/40 bg-orange-500/10 text-orange-500" : "border-border hover:bg-muted"}`}
                >
                  2ª linha
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={form.due_at}
                  onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Criando…" : "Criar O.S."}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BatchesByStage({
  orders,
  products,
  onOpenBatch,
}: {
  orders: Order[];
  products: ProductRef[];
  onOpenBatch: (code: string, stage: Stage | null) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<Stage | "sem_setor", Map<string, Order[]>>();
    for (const o of orders) {
      if (!o.batch_code) continue;
      const stageKey: Stage | "sem_setor" = o.stage ?? "sem_setor";
      if (!m.has(stageKey)) m.set(stageKey, new Map());
      const stageMap = m.get(stageKey)!;
      if (!stageMap.has(o.batch_code)) stageMap.set(o.batch_code, []);
      stageMap.get(o.batch_code)!.push(o);
    }
    return m;
  }, [orders]);

  const stages: (Stage | "sem_setor")[] = [...(Object.keys(STAGE_LABEL) as Stage[]), "sem_setor"];

  if (grouped.size === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nenhum lote cadastrado. Defina o campo <b>Lote</b> ao criar/editar uma OP para agrupar
        referências do mesmo lote de produção.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Lotes agrupados por setor. Clique em um lote para ver as referências que compõem o lote.
      </p>
      {stages.map((st) => {
        const stageMap = grouped.get(st);
        if (!stageMap || stageMap.size === 0) return null;
        const stageLabel = st === "sem_setor" ? "Sem setor" : STAGE_LABEL[st];
        return (
          <div key={st} className="rounded-xl border border-border bg-card/40">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">{stageLabel}</h3>
              <span className="text-xs text-muted-foreground">{stageMap.size} lote(s)</span>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from(stageMap.entries()).map(([batch, ops]) => {
                const totalQty = ops.reduce((s, o) => s + (o.quantity || 0), 0);
                const refs = ops
                  .map((o) => products.find((p) => p.id === o.product_id))
                  .filter(Boolean) as ProductRef[];
                const thumbs = refs.slice(0, 4);
                const refCount = new Set(ops.map((o) => o.product_id).filter(Boolean)).size;
                return (
                  <button
                    key={batch}
                    onClick={() => onOpenBatch(batch, st === "sem_setor" ? null : st)}
                    className="text-left rounded-lg border border-border bg-background p-3 hover:border-primary/50 hover:bg-muted/30 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 font-semibold text-sm">
                        <Boxes className="size-4 text-primary" />
                        Lote {batch}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {ops.length} OP · {totalQty} pç
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {thumbs.map((p, i) => (
                        <div
                          key={i}
                          className="size-10 rounded border border-border bg-muted/40 overflow-hidden grid place-items-center"
                        >
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="size-4 text-muted-foreground/60" />
                          )}
                        </div>
                      ))}
                      {refs.length > thumbs.length && (
                        <div className="size-10 rounded border border-border bg-muted/40 grid place-items-center text-[10px] text-muted-foreground">
                          +{refs.length - thumbs.length}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {refCount} referência(s)
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BatchDialog({
  batch,
  orders,
  products,
  suppliers,
  onClose,
}: {
  batch: { code: string; stage: Stage | null } | null;
  orders: Order[];
  products: ProductRef[];
  suppliers: Ref[];
  onClose: () => void;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const rows = useMemo(() => {
    if (!batch) return [];
    return orders.filter((o) => o.batch_code === batch.code);
  }, [batch, orders]);

  const totalQty = rows.reduce((s, o) => s + (o.quantity || 0), 0);
  const refCount = new Set(rows.map((o) => o.product_id).filter(Boolean)).size;

  return (
    <Dialog open={!!batch} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="size-5 text-primary" />
            Lote {batch?.code}
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          {batch?.stage && <Badge variant="outline">{STAGE_LABEL[batch.stage]}</Badge>}
          <span>
            {rows.length} OP · {refCount} referência(s) · {totalQty} pç totais
          </span>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma referência neste lote.</p>
          )}
          {rows.map((o) => {
            const p = productById.get(o.product_id ?? "");
            const s = supplierById.get(o.supplier_id ?? "");
            return (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="size-14 rounded border border-border bg-muted/40 overflow-hidden grid place-items-center shrink-0">
                  {p?.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="size-5 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{o.code}</span>
                    {o.stage && (
                      <Badge variant="outline" className="text-[10px]">
                        {STAGE_LABEL[o.stage]}
                      </Badge>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[o.priority ?? 3]}`}
                    >
                      P{o.priority ?? 3}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate">{p?.name ?? "Sem produto"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {p?.sku ?? "—"} · {s?.name ?? "—"} · {o.quantity} pç · {o.progress}%
                  </div>
                </div>
                {o.product_id && (
                  <Link
                    to="/ficha-tecnica"
                    onClick={onClose}
                    className="text-xs inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                  >
                    <FileText className="size-3" /> Ficha
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
