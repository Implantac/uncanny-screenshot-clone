import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Scissors, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pilots")({ component: Pilots });

type Stage = "solicitado" | "em_confeccao" | "em_prova" | "aprovado" | "reprovado";
type Pilot = {
  id: string;
  code: string;
  stage: Stage;
  due_date: string | null;
  notes: string | null;
  supplier?: string | null;
  product?: string | null;
};

const STAGES: { key: Stage; label: string; tone: string }[] = [
  { key: "solicitado", label: "Solicitado", tone: "bg-muted text-muted-foreground" },
  { key: "em_confeccao", label: "Em confecção", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { key: "em_prova", label: "Em prova", tone: "bg-primary/15 text-primary" },
  { key: "aprovado", label: "Aprovado", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "reprovado", label: "Reprovado", tone: "bg-destructive/15 text-destructive" },
];

async function load(): Promise<Pilot[]> {
  const { data } = await supabase
    .from("prototypes")
    .select("id, code, stage, due_date, notes, suppliers(name), products(name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []).map((p) => ({
    ...p,
    supplier: (p.suppliers as { name?: string } | null)?.name ?? null,
    product: (p.products as { name?: string } | null)?.name ?? null,
  })) as Pilot[];
}

function Pilots() {
  const qc = useQueryClient();
  const { data: pilots = [], isLoading } = useQuery({ queryKey: ["pilots"], queryFn: load });
  const [filter, setFilter] = useState<Stage | "all">("all");

  const mutate = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("prototypes").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["pilots"] }); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (filter === "all" ? pilots : pilots.filter((p) => p.stage === filter)),
    [pilots, filter]
  );

  const summary = useMemo(() => ({
    total: pilots.length,
    inProgress: pilots.filter((p) => p.stage === "em_confeccao" || p.stage === "em_prova").length,
    approved: pilots.filter((p) => p.stage === "aprovado").length,
    rejected: pilots.filter((p) => p.stage === "reprovado").length,
  }), [pilots]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão de Pilotos</h1>
        <p className="text-sm text-muted-foreground">Ciclo de aprovação de pilotos com histórico e status dedicados.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total" value={summary.total} icon={<Scissors className="size-4" />} />
        <KPI label="Em andamento" value={summary.inProgress} icon={<Clock className="size-4" />} tone="primary" />
        <KPI label="Aprovados" value={summary.approved} icon={<CheckCircle2 className="size-4" />} tone="success" />
        <KPI label="Reprovados" value={summary.rejected} icon={<XCircle className="size-4" />} tone="destructive" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos</Chip>
        {STAGES.map((s) => (
          <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>{s.label}</Chip>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-left px-3 py-2">Fornecedor</th>
              <th className="text-left px-3 py-2">Prazo</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Sem pilotos.</td></tr>
            ) : filtered.map((p) => {
              const stage = STAGES.find((s) => s.key === p.stage)!;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{p.code}</td>
                  <td className="px-3 py-2">{p.product ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.supplier ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-1 rounded ${stage.tone}`}>{stage.label}</span></td>
                  <td className="px-3 py-2 text-right">
                    <select
                      value={p.stage}
                      onChange={(e) => mutate.mutate({ id: p.id, stage: e.target.value as Stage })}
                      className="text-xs bg-background border border-border rounded px-2 py-1"
                    >
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`text-xs px-3 py-1.5 rounded-full border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>{children}</button>
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
