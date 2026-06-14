import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Factory, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pcp-kanban")({ component: PcpKanban });

type Status = "aguardando" | "em_producao" | "concluida" | "atrasada" | "cancelada";
type Order = {
  id: string;
  code: string;
  status: Status;
  quantity: number;
  progress: number;
  due_date: string | null;
  supplier?: string | null;
  product?: string | null;
};

const COLUMNS: { key: Status; label: string; tone: string }[] = [
  { key: "aguardando", label: "Programado", tone: "bg-muted text-muted-foreground" },
  { key: "em_producao", label: "Em produção", tone: "bg-primary/15 text-primary" },
  { key: "atrasada", label: "Atrasada", tone: "bg-destructive/15 text-destructive" },
  { key: "concluida", label: "Concluída", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "cancelada", label: "Cancelada", tone: "bg-muted text-muted-foreground line-through" },
];

async function load(): Promise<Order[]> {
  const { data } = await supabase
    .from("production_orders")
    .select("id, code, status, quantity, progress, due_date, suppliers(name), products(name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []).map((o) => ({
    ...o,
    supplier: (o.suppliers as { name?: string } | null)?.name ?? null,
    product: (o.products as { name?: string } | null)?.name ?? null,
  })) as Order[];
}

function PcpKanban() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["pcp-kanban"], queryFn: load });
  const [dragging, setDragging] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("production_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["pcp-kanban"] }); },
    onError: (e) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const m = new Map<Status, Order[]>();
    COLUMNS.forEach((c) => m.set(c.key, []));
    orders.forEach((o) => m.get(o.status)?.push(o));
    return m;
  }, [orders]);

  const summary = useMemo(() => {
    const wip = orders.filter((o) => o.status === "em_producao").reduce((s, o) => s + o.quantity, 0);
    const late = orders.filter((o) => o.status === "atrasada").length;
    const total = orders.length;
    return { wip, late, total };
  }, [orders]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">PCP Kanban</h1>
        <p className="text-sm text-muted-foreground">Arraste cards para mover ordens entre setores.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="Ordens totais" value={summary.total} icon={<Factory className="size-4" />} />
        <KPI label="WIP (peças)" value={summary.wip.toLocaleString("pt-BR")} icon={<Clock className="size-4" />} tone="primary" />
        <KPI label="Atrasadas" value={summary.late} icon={<AlertTriangle className="size-4" />} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? [];
          return (
            <div
              key={col.key}
              className="rounded-xl border border-border bg-card flex flex-col min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging) {
                  const o = orders.find((x) => x.id === dragging);
                  if (o && o.status !== col.key) mutate.mutate({ id: dragging, status: col.key });
                  setDragging(null);
                }
              }}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-1 rounded ${col.tone}`}>{col.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {isLoading ? (
                  <div className="text-xs text-muted-foreground p-2">Carregando…</div>
                ) : items.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2">—</div>
                ) : items.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => setDragging(o.id)}
                    onDragEnd={() => setDragging(null)}
                    className="rounded-lg border border-border bg-background p-3 text-xs space-y-1 cursor-grab active:cursor-grabbing hover:border-primary/50 transition"
                  >
                    <div className="font-medium text-sm">{o.code}</div>
                    {o.product && <div className="text-muted-foreground truncate">{o.product}</div>}
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{o.quantity} pç</span>
                      <span>{o.progress}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${o.progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground pt-1">
                      <span className="truncate">{o.supplier ?? "—"}</span>
                      {o.due_date && <span>{new Date(o.due_date).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" | "destructive" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
