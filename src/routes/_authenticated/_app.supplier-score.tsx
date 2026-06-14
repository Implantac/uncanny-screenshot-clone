import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Star, Truck, CheckCircle2, AlertTriangle, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/supplier-score")({
  component: SupplierScore,
});

type Row = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  rating: number;
  active: boolean;
  orders: number;
  onTime: number;
  late: number;
  completed: number;
  totalQty: number;
  otdPct: number;
  avgProgress: number;
  score: number;
  tier: "ouro" | "prata" | "bronze" | "atencao";
};

async function load(): Promise<Row[]> {
  const [{ data: sups }, { data: ords }] = await Promise.all([
    supabase.from("suppliers").select("*"),
    supabase.from("production_orders").select("supplier_id, status, quantity, progress, due_date, updated_at"),
  ]);
  const byS = new Map<string, typeof ords>();
  (ords ?? []).forEach((o) => {
    if (!o.supplier_id) return;
    const arr = byS.get(o.supplier_id) ?? [];
    arr.push(o);
    byS.set(o.supplier_id, arr);
  });
  const today = Date.now();
  return (sups ?? []).map((s) => {
    const list = byS.get(s.id) ?? [];
    const orders = list.length;
    const completed = list.filter((o) => o.status === "concluida").length;
    const late = list.filter((o) => o.due_date && new Date(o.due_date).getTime() < today && o.status !== "concluida").length;
    const onTime = completed - list.filter((o) => o.status === "concluida" && o.due_date && new Date(o.updated_at).getTime() > new Date(o.due_date).getTime()).length;
    const otdPct = completed > 0 ? (onTime / completed) * 100 : 0;
    const totalQty = list.reduce((a, o) => a + (o.quantity ?? 0), 0);
    const avgProgress = orders > 0 ? list.reduce((a, o) => a + o.progress, 0) / orders : 0;
    const score = Math.round((otdPct * 0.5) + (avgProgress * 0.3) + ((s.rating ?? 0) * 20 * 0.2));
    const tier: Row["tier"] = score >= 80 ? "ouro" : score >= 60 ? "prata" : score >= 40 ? "bronze" : "atencao";
    return {
      id: s.id, name: s.name, category: s.category, city: s.city, state: s.state,
      rating: s.rating ?? 0, active: s.active,
      orders, onTime, late, completed, totalQty, otdPct, avgProgress, score, tier,
    };
  }).sort((a, b) => b.score - a.score);
}

function SupplierScore() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["supplier-score"], queryFn: load });

  const summary = useMemo(() => ({
    total: rows.length,
    ouro: rows.filter((r) => r.tier === "ouro").length,
    atencao: rows.filter((r) => r.tier === "atencao").length,
    avgOtd: rows.length > 0 ? rows.reduce((s, r) => s + r.otdPct, 0) / rows.length : 0,
  }), [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Supplier Scorecard</h1>
        <p className="text-sm text-muted-foreground">OTD, qualidade e rating consolidados em um score 0–100.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Fornecedores" value={summary.total} icon={<Truck className="size-4" />} />
        <KPI label="Tier Ouro" value={summary.ouro} icon={<Trophy className="size-4" />} tone="success" />
        <KPI label="Em atenção" value={summary.atencao} icon={<AlertTriangle className="size-4" />} tone="destructive" />
        <KPI label="OTD médio" value={`${summary.avgOtd.toFixed(0)}%`} icon={<CheckCircle2 className="size-4" />} tone="primary" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2">Fornecedor</th>
                <th className="text-left px-3 py-2">Local</th>
                <th className="text-right px-3 py-2">Ordens</th>
                <th className="text-right px-3 py-2">Peças</th>
                <th className="text-right px-3 py-2">Concluídas</th>
                <th className="text-right px-3 py-2">Atrasadas</th>
                <th className="text-right px-3 py-2">OTD</th>
                <th className="text-right px-3 py-2">Rating</th>
                <th className="text-right px-3 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Sem fornecedores cadastrados.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2"><Tier t={r.tier} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground">{r.category ?? "—"}{!r.active && " • inativo"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.city ? `${r.city}/${r.state ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 text-right">{r.orders}</td>
                  <td className="px-3 py-2 text-right">{r.totalQty.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right text-success">{r.completed}</td>
                  <td className={`px-3 py-2 text-right ${r.late > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{r.late}</td>
                  <td className={`px-3 py-2 text-right ${r.otdPct >= 80 ? "text-success" : r.otdPct >= 50 ? "text-warning" : "text-destructive"}`}>{r.otdPct.toFixed(0)}%</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-0.5 text-warning">{"★".repeat(r.rating)}<span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span></span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tier({ t }: { t: Row["tier"] }) {
  const map = {
    ouro: ["bg-success/15 text-success", "★ Ouro"],
    prata: ["bg-primary/15 text-primary", "Prata"],
    bronze: ["bg-warning/15 text-warning", "Bronze"],
    atencao: ["bg-destructive/15 text-destructive", "Atenção"],
  } as const;
  const [cls, label] = map[t];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: number | string; icon: React.ReactNode; tone?: "default" | "success" | "destructive" | "primary" }) {
  const tones = { default: "", success: "text-success", destructive: "text-destructive", primary: "text-primary" };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}
