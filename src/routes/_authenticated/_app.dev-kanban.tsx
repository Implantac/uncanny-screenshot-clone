import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Sparkles, CheckCircle2, Clock, ImageIcon, AlertTriangle, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";
import { PersonaInsightsPanel } from "@/components/persona-insights-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/dev-kanban")({ component: DevKanban });

type Status = "rascunho" | "desenvolvimento" | "aprovado" | "producao" | "descontinuado";
type Product = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  status: Status;
  image_url: string | null;
  sell_price: number | null;
  updated_at: string | null;
};

const COLUMNS: { key: Status; label: string; tone: string }[] = [
  { key: "rascunho", label: "Pesquisa / Briefing", tone: "bg-muted text-muted-foreground" },
  {
    key: "desenvolvimento",
    label: "Em desenvolvimento",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    key: "aprovado",
    label: "Aprovado",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  { key: "producao", label: "Liberado p/ PCP", tone: "bg-primary/15 text-primary" },
  {
    key: "descontinuado",
    label: "Descontinuado",
    tone: "bg-muted text-muted-foreground line-through",
  },
];

async function load(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, category, status, image_url, sell_price, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
}

function DevKanban() {
  const qc = useQueryClient();
  useRealtime("products", ["dev-kanban"]);
  const { data: products = [], isLoading } = useQuery({ queryKey: ["dev-kanban"], queryFn: load });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  const mutate = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("products").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["dev-kanban"] });
      const prev = qc.getQueryData<Product[]>(["dev-kanban"]);
      qc.setQueryData<Product[]>(["dev-kanban"], (old = []) =>
        old.map((p) => (p.id === id ? { ...p, status } : p)),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dev-kanban"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Status atualizado"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dev-kanban"] }),
  });

  const grouped = useMemo(() => {
    const m = new Map<Status, Product[]>();
    COLUMNS.forEach((c) => m.set(c.key, []));
    products.forEach((p) => m.get(p.status)?.push(p));
    return m;
  }, [products]);

  const summary = useMemo(
    () => ({
      total: products.length,
      dev: products.filter((p) => p.status === "desenvolvimento").length,
      approved: products.filter((p) => p.status === "aprovado").length,
    }),
    [products],
  );

  const stuck = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return products
      .filter(
        (p) =>
          p.status === "desenvolvimento" &&
          p.updated_at &&
          new Date(p.updated_at).getTime() < cutoff,
      )
      .sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime())
      .slice(0, 6);
  }, [products]);

  const moveTo = (id: string, status: Status) => {
    const p = products.find((x) => x.id === id);
    if (!p || p.status === status) return;
    mutate.mutate({ id, status });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        eyebrow="Desenvolvimento"
        title="Kanban de Desenvolvimento"
        description="Pipeline do produto: pesquisa → modelagem → liberação para PCP. Arraste cards ou use o seletor de status (mobile)."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <LayoutGrid className="size-3.5" />
            {summary.total} no pipeline
          </Badge>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <KPI
          label="Produtos no pipeline"
          value={summary.total}
          icon={<Sparkles className="size-4" />}
        />
        <KPI
          label="Em desenvolvimento"
          value={summary.dev}
          icon={<Clock className="size-4" />}
          tone="primary"
        />
        <KPI
          label="Aprovados"
          value={summary.approved}
          icon={<CheckCircle2 className="size-4" />}
          tone="success"
        />
      </div>

      {stuck.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="size-4 animate-pulse" />
              {stuck.length} produto{stuck.length > 1 ? "s" : ""} parado
              {stuck.length > 1 ? "s" : ""} em desenvolvimento há mais de 7 dias
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Decida agora: avançar para Aprovado, voltar para Briefing ou descontinuar. Cada dia
            parado segura a coleção.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stuck.map((p) => {
              const days = Math.floor((Date.now() - new Date(p.updated_at!).getTime()) / 86400_000);
              return (
                <div key={p.id} className="rounded-lg border border-warning/30 bg-card p-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-warning shrink-0" />
                    <div className="font-medium text-sm truncate">{p.name}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {p.sku} · parado há {days}d
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PersonaInsightsPanel persona="coord-dev" />

      <AICoordinatorPanel
        persona="development"
        title="Coordenador de Desenvolvimento — leitura do pipeline"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? [];
          const isOver = over === col.key;
          return (
            <div
              key={col.key}
              className={`rounded-xl border bg-card flex flex-col min-h-[400px] transition ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((v) => (v === col.key ? null : v))}
              onDrop={() => {
                if (dragging) {
                  moveTo(dragging, col.key);
                  setDragging(null);
                  setOver(null);
                }
              }}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-1 rounded ${col.tone}`}>
                  {col.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {isLoading ? (
                  <div className="text-xs text-muted-foreground p-2">Carregando…</div>
                ) : items.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground p-3 border border-dashed border-border rounded-lg text-center">
                    Solte aqui
                  </div>
                ) : (
                  items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragging(p.id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className="group rounded-lg border border-border bg-background p-3 text-xs space-y-1 cursor-grab active:cursor-grabbing hover:border-primary/50 transition"
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-20 object-cover rounded mb-2 bg-muted"
                        />
                      ) : (
                        <div className="w-full h-20 rounded mb-2 bg-muted grid place-items-center text-muted-foreground">
                          <ImageIcon className="size-5" />
                        </div>
                      )}
                      <div className="font-medium text-sm truncate" title={p.name}>
                        {p.name}
                      </div>
                      <div className="text-muted-foreground tabular-nums">{p.sku}</div>
                      <div className="flex items-center justify-between text-muted-foreground pt-1">
                        <span className="truncate">{p.category ?? "—"}</span>
                        {p.sell_price ? (
                          <span className="tabular-nums">R$ {Number(p.sell_price).toFixed(0)}</span>
                        ) : null}
                      </div>
                      <select
                        className="md:opacity-0 md:group-hover:opacity-100 transition w-full mt-1 text-[10px] bg-muted/50 border border-border rounded px-1 py-0.5"
                        value={p.status}
                        onChange={(e) => moveTo(p.id, e.target.value as Status)}
                        aria-label="Mover para status"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
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
  tone?: "default" | "primary" | "success";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
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
