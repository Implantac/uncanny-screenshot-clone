import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Scissors, CheckCircle2, XCircle, Clock, ArrowRight, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/pilots")({ component: Pilots });

type Stage = "solicitado" | "em_confeccao" | "em_prova" | "aprovado" | "reprovado";
type Pilot = {
  id: string;
  code: string;
  name: string | null;
  stage: Stage;
  due_date: string | null;
  notes: string | null;
  supplier?: string | null;
  product?: string | null;
};

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "solicitado",   label: "Solicitado",   hint: "Aguardando modelagem" },
  { key: "em_confeccao", label: "Em confecção", hint: "Costura do piloto" },
  { key: "em_prova",     label: "Em prova",     hint: "Fit session" },
  { key: "aprovado",     label: "Aprovado",     hint: "→ gera OP" },
  { key: "reprovado",    label: "Reprovado",    hint: "Reiniciar ciclo" },
];

async function load(): Promise<Pilot[]> {
  const { data } = await supabase
    .from("prototypes")
    .select("id, code, name, stage, due_date, notes, suppliers(name), products(name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []).map((p: any) => ({
    ...p,
    supplier: p.suppliers?.name ?? null,
    product: p.products?.name ?? null,
  })) as Pilot[];
}

function daysTo(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function Pilots() {
  const qc = useQueryClient();
  useRealtime("prototypes", ["pilots"]);
  const { data: pilots = [], isLoading } = useQuery({ queryKey: ["pilots"], queryFn: load });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [view, setView] = useState<"kanban" | "lista">("kanban");

  const update = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("prototypes").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["pilots"] });
      const prev = qc.getQueryData<Pilot[]>(["pilots"]);
      qc.setQueryData<Pilot[]>(["pilots"], (old = []) =>
        old.map((p) => (p.id === patch.id ? { ...p, stage: patch.stage } : p)),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pilots"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pilots"] }),
  });

  const grouped = useMemo(() => {
    const m = new Map<Stage, Pilot[]>();
    STAGES.forEach((s) => m.set(s.key, []));
    pilots.forEach((p) => m.get(p.stage)?.push(p));
    return m;
  }, [pilots]);

  const summary = useMemo(() => ({
    total: pilots.length,
    inProgress: pilots.filter((p) => p.stage === "em_confeccao" || p.stage === "em_prova").length,
    approved: pilots.filter((p) => p.stage === "aprovado").length,
    rejected: pilots.filter((p) => p.stage === "reprovado").length,
  }), [pilots]);

  const move = (id: string, stage: Stage) => {
    const p = pilots.find((x) => x.id === id);
    if (!p || p.stage === stage) return;
    update.mutate({ id, stage });
    toast.success(`${p.code} → ${STAGES.find((s) => s.key === stage)?.label}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pilot Center</h1>
          <p className="text-sm text-muted-foreground">Arraste pilotos entre etapas. Aprovado dispara OP automaticamente.</p>
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded ${view === "kanban" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Kanban</button>
          <button onClick={() => setView("lista")} className={`px-3 py-1.5 rounded ${view === "lista" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Lista</button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total" value={summary.total} icon={<Scissors className="size-4" />} />
        <KPI label="Em andamento" value={summary.inProgress} icon={<Clock className="size-4" />} tone="primary" />
        <KPI label="Aprovados" value={summary.approved} icon={<CheckCircle2 className="size-4" />} tone="success" />
        <KPI label="Reprovados" value={summary.rejected} icon={<XCircle className="size-4" />} tone="destructive" />
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {STAGES.map((col) => {
            const items = grouped.get(col.key) ?? [];
            const isOver = over === col.key;
            return (
              <div
                key={col.key}
                className={`rounded-xl border bg-card flex flex-col min-h-[420px] transition ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
                onDragLeave={() => setOver((v) => (v === col.key ? null : v))}
                onDrop={() => { if (dragging) { move(dragging, col.key); setDragging(null); setOver(null); } }}
              >
                <div className="px-3 py-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{col.hint}</div>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {isLoading ? (
                    <div className="text-xs text-muted-foreground p-2">Carregando…</div>
                  ) : items.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground p-3 border border-dashed border-border rounded-lg text-center">Solte aqui</div>
                  ) : items.map((p) => {
                    const d = daysTo(p.due_date);
                    const overdue = d !== null && d < 0 && col.key !== "aprovado" && col.key !== "reprovado";
                    const nextStage = STAGES[STAGES.findIndex((s) => s.key === col.key) + 1];
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDragging(p.id)}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        className={`group rounded-lg border bg-background p-2.5 text-xs space-y-1.5 cursor-grab active:cursor-grabbing hover:border-primary/50 transition ${overdue ? "border-destructive/60" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums">{p.code}</span>
                          {p.notes && <MessageSquare className="size-3 text-muted-foreground" />}
                        </div>
                        {p.name && <div className="truncate" title={p.name}>{p.name}</div>}
                        {p.product && <div className="text-muted-foreground truncate" title={p.product}>{p.product}</div>}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                          <span className="truncate">{p.supplier ?? "Interno"}</span>
                          {p.due_date && (
                            <span className={overdue ? "text-destructive font-medium" : ""}>
                              {d! < 0 ? `${Math.abs(d!)}d` : d === 0 ? "hoje" : `${d}d`}
                            </span>
                          )}
                        </div>
                        {nextStage && (
                          <div className="md:opacity-0 md:group-hover:opacity-100 transition pt-1">
                            <button
                              onClick={() => move(p.id, nextStage.key)}
                              className="w-full text-[10px] inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
                            >
                              <ArrowRight className="size-3" /> {nextStage.label}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-left px-3 py-2">Fornecedor</th>
                <th className="text-left px-3 py-2">Prazo</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {pilots.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{p.code}</td>
                  <td className="px-3 py-2">{p.product ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.supplier ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={p.stage}
                      onChange={(e) => update.mutate({ id: p.id, stage: e.target.value as Stage })}
                      className="text-xs bg-background border border-border rounded px-2 py-1"
                    >
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" | "success" | "destructive" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
