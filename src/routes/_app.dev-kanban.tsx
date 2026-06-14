import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Sparkles, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dev-kanban")({ component: DevKanban });

type Status = "rascunho" | "desenvolvimento" | "aprovado" | "producao" | "descontinuado";
type Product = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  status: Status;
  image_url: string | null;
  sell_price: number | null;
};

const COLUMNS: { key: Status; label: string; tone: string }[] = [
  { key: "rascunho", label: "Pesquisa / Briefing", tone: "bg-muted text-muted-foreground" },
  { key: "desenvolvimento", label: "Em desenvolvimento", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { key: "aprovado", label: "Aprovado", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "producao", label: "Liberado p/ PCP", tone: "bg-primary/15 text-primary" },
  { key: "descontinuado", label: "Descontinuado", tone: "bg-muted text-muted-foreground line-through" },
];

async function load(): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("id, sku, name, category, status, image_url, sell_price")
    .order("updated_at", { ascending: false });
  return (data ?? []) as Product[];
}

function DevKanban() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["dev-kanban"], queryFn: load });
  const [dragging, setDragging] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("products").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["dev-kanban"] }); },
    onError: (e) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const m = new Map<Status, Product[]>();
    COLUMNS.forEach((c) => m.set(c.key, []));
    products.forEach((p) => m.get(p.status)?.push(p));
    return m;
  }, [products]);

  const summary = useMemo(() => ({
    total: products.length,
    dev: products.filter((p) => p.status === "desenvolvimento").length,
    approved: products.filter((p) => p.status === "aprovado").length,
  }), [products]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Kanban de Desenvolvimento</h1>
        <p className="text-sm text-muted-foreground">Pipeline do produto: pesquisa → modelagem → liberação para PCP.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="Produtos no pipeline" value={summary.total} icon={<Sparkles className="size-4" />} />
        <KPI label="Em desenvolvimento" value={summary.dev} icon={<Clock className="size-4" />} tone="primary" />
        <KPI label="Aprovados" value={summary.approved} icon={<CheckCircle2 className="size-4" />} tone="success" />
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
                  const p = products.find((x) => x.id === dragging);
                  if (p && p.status !== col.key) mutate.mutate({ id: dragging, status: col.key });
                  setDragging(null);
                }
              }}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-1 rounded ${col.tone}`}>{col.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {isLoading ? <div className="text-xs text-muted-foreground p-2">Carregando…</div> :
                  items.length === 0 ? <div className="text-xs text-muted-foreground p-2">—</div> :
                  items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragging(p.id)}
                      onDragEnd={() => setDragging(null)}
                      className="rounded-lg border border-border bg-background p-3 text-xs space-y-1 cursor-grab active:cursor-grabbing hover:border-primary/50 transition"
                    >
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-20 object-cover rounded mb-2" />}
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-muted-foreground">{p.sku}</div>
                      <div className="flex items-center justify-between text-muted-foreground pt-1">
                        <span className="truncate">{p.category ?? "—"}</span>
                        {p.sell_price ? <span>R$ {Number(p.sell_price).toFixed(0)}</span> : null}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" | "success" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
