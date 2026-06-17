import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { Scissors, Sparkles, Ruler, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/centro-de-corte")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string().trim().max(80), "").default("") })),
  head: () => ({
    meta: [
      { title: "Centro de Corte · USE MODA OS" },
      { name: "description", content: "Plano de corte e acompanhamento de peças cortadas." },
    ],
  }),
  component: CentroCorte,
});

type Phase = "corte" | "costura" | "acabamento" | "concluido";
type OP = {
  id: string; code: string; quantity: number; progress: number;
  due_date: string | null; status: string; product_id: string | null;
};

const phaseOf = (p: number): Phase =>
  p >= 100 ? "concluido" : p >= 80 ? "acabamento" : p >= 30 ? "costura" : "corte";

const PHASE_LABEL: Record<Phase, string> = {
  corte: "Em corte", costura: "Em costura", acabamento: "Acabamento", concluido: "Concluído",
};
const PHASE_STYLE: Record<Phase, string> = {
  corte: "bg-amber-500/15 text-amber-400",
  costura: "bg-sky-500/15 text-sky-400",
  acabamento: "bg-violet-500/15 text-violet-400",
  concluido: "bg-emerald-500/15 text-emerald-400",
};

function CentroCorte() {
  const qc = useQueryClient();
  useRealtime("production_orders", ["production_orders"]);
  const { q: search } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (v: string) => navigate({ search: (p: { q: string }) => ({ ...p, q: v }), replace: true });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("id,code,quantity,progress,due_date,status,product_id").order("due_date", { ascending: true });
      if (error) throw error;
      return data as OP[];
    },
  });

  const cuttingMut = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase.from("production_orders").update({ progress, status: "em_producao" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production_orders"] }); toast.success("Plano de corte atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return rows.filter((r) => !s || r.code.toLowerCase().includes(s));
  }, [rows, search]);

  const cutting = filtered.filter((r) => phaseOf(r.progress) === "corte" && r.status !== "cancelada");
  const totalPecas = filtered.reduce((a, b) => a + b.quantity, 0);
  const pecasCortadas = filtered.reduce((a, b) => a + Math.round((b.quantity * Math.min(b.progress, 30)) / 30), 0);
  const opsConcluidas = filtered.filter((r) => phaseOf(r.progress) === "concluido").length;
  const atrasadasNoCorte = cutting.filter((r) => r.due_date && new Date(r.due_date).getTime() < Date.now()).length;
  const pecasPendentesCorte = cutting.reduce((a, b) => a + Math.max(0, b.quantity - Math.round((b.quantity * Math.min(b.progress, 30)) / 30)), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Scissors className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Centro de Corte</h1>
            <p className="text-sm text-muted-foreground">Plano de corte e enfesto · derivado das OPs</p>
          </div>
        </div>
        <Input placeholder="Buscar OP…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<Ruler className="size-4" />} label="OPs em corte" value={String(cutting.length)} />
        <Kpi icon={<Scissors className="size-4" />} label="Peças no plano" value={totalPecas.toLocaleString("pt-BR")} />
        <Kpi icon={<Sparkles className="size-4" />} label="Peças cortadas (est.)" value={pecasCortadas.toLocaleString("pt-BR")} />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="OPs concluídas" value={String(opsConcluidas)} />
      </div>

      <div className={`rounded-xl border p-4 ${atrasadasNoCorte ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
        <div className="text-sm font-medium">Fila inteligente do corte</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {atrasadasNoCorte
            ? `${atrasadasNoCorte} OP(s) em corte já estão atrasadas. Priorize esses enfestos antes de iniciar novos riscos.`
            : `${pecasPendentesCorte.toLocaleString("pt-BR")} peça(s) ainda precisam ser cortadas. Libere primeiro as OPs com menor prazo para não represar costura.`}
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Scissors className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Sem ordens de produção</h3>
          <p className="text-sm text-muted-foreground">Crie OPs em PCP para alimentar o plano de corte.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border text-sm font-semibold">Plano de corte</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">OP</th>
                  <th className="text-left font-medium px-5 py-2.5">Fase</th>
                  <th className="text-right font-medium px-5 py-2.5">Peças</th>
                  <th className="text-left font-medium px-5 py-2.5">Entrega</th>
                  <th className="text-left font-medium px-5 py-2.5 w-[180px]">Progresso</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const phase = phaseOf(r.progress);
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{r.code}</td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${PHASE_STYLE[phase]}`}>{PHASE_LABEL[phase]}</span></td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.quantity.toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">{r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${r.progress}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{r.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {phase === "corte" && (
                          <Button size="sm" variant="outline" onClick={() => cuttingMut.mutate({ id: r.id, progress: 30 })}>
                            Marcar cortado
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
