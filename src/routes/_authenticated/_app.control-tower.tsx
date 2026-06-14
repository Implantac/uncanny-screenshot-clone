import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/_app/control-tower")({
  component: ControlTower,
});

const GRADES = ["PP", "P", "M", "G", "GG", "XG", "XXG"];
const DEFAULT_MIX: Record<string, number> = { PP: 0.08, P: 0.18, M: 0.32, G: 0.24, GG: 0.12, XG: 0.04, XXG: 0.02 };

type Row = {
  product_id: string;
  sku: string;
  name: string;
  collection: string | null;
  stock: number;
  minimum: number;
  sold30: number;
  pending: number;
  producing: number;
  coverage: number;
  need: number;
  status: "red" | "yellow" | "green";
  byGrade: Record<string, number>;
};

async function loadData(): Promise<Row[]> {
  const [{ data: products }, { data: sales }, { data: inv }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id, sku, name, sizes, collection_id, collections(name)").limit(500),
    supabase.from("sales").select("product_id, sku, quantity, sold_at").gte("sold_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("inventory_items").select("sku, balance, minimum"),
    supabase.from("production_orders").select("product_id, quantity, status"),
  ]);

  const invBySku = new Map((inv ?? []).map((i) => [i.sku, i]));
  const soldByProd = new Map<string, number>();
  (sales ?? []).forEach((s) => {
    if (s.product_id) soldByProd.set(s.product_id, (soldByProd.get(s.product_id) ?? 0) + s.quantity);
  });
  const prodByProd = new Map<string, number>();
  (orders ?? []).forEach((o) => {
    if (o.product_id && o.status !== "concluida" && o.status !== "cancelada") {
      prodByProd.set(o.product_id, (prodByProd.get(o.product_id) ?? 0) + (o.quantity ?? 0));
    }
  });

  return (products ?? []).map((p) => {
    const invItem = invBySku.get(p.sku);
    const stock = Number(invItem?.balance ?? 0);
    const minimum = Number(invItem?.minimum ?? 0);
    const sold30 = soldByProd.get(p.id) ?? 0;
    const producing = prodByProd.get(p.id) ?? 0;
    const dailyAvg = sold30 / 30;
    const coverage = dailyAvg > 0 ? Math.floor(stock / dailyAvg) : 999;
    const target = Math.max(minimum * 2, Math.ceil(dailyAvg * 45));
    const need = Math.max(0, target - stock - producing);
    const status: Row["status"] = coverage < 7 ? "red" : coverage < 21 ? "yellow" : "green";

    const sizes = (p.sizes ?? []) as string[];
    const activeGrades = sizes.length > 0 ? sizes.filter((s) => GRADES.includes(s)) : GRADES;
    const totalWeight = activeGrades.reduce((a, g) => a + (DEFAULT_MIX[g] ?? 0.1), 0);
    const byGrade: Record<string, number> = {};
    activeGrades.forEach((g) => {
      byGrade[g] = Math.round((need * (DEFAULT_MIX[g] ?? 0.1)) / totalWeight);
    });

    return {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      collection: (p.collections as { name?: string } | null)?.name ?? null,
      stock,
      minimum,
      sold30,
      pending: 0,
      producing,
      coverage,
      need,
      status,
      byGrade,
    };
  }).sort((a, b) => b.need - a.need);
}

function ControlTower() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["control-tower"], queryFn: loadData });

  const summary = useMemo(() => ({
    red: rows.filter((r) => r.status === "red").length,
    yellow: rows.filter((r) => r.status === "yellow").length,
    green: rows.filter((r) => r.status === "green").length,
    totalNeed: rows.reduce((a, r) => a + r.need, 0),
  }), [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Demand & Supply Control Tower</h1>
        <p className="text-sm text-muted-foreground">O que produzir agora — com cobertura, necessidade e quebra por grade.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Produção urgente" value={summary.red} icon={<AlertTriangle className="size-4" />} tone="red" />
        <Card label="Atenção" value={summary.yellow} icon={<AlertCircle className="size-4" />} tone="yellow" />
        <Card label="Saudável" value={summary.green} icon={<CheckCircle2 className="size-4" />} tone="green" />
        <Card label="Peças a produzir" value={summary.totalNeed.toLocaleString("pt-BR")} tone="primary" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2">Estoque</th>
                <th className="text-right px-3 py-2">Mín</th>
                <th className="text-right px-3 py-2">Vendido 30d</th>
                <th className="text-right px-3 py-2">Produzindo</th>
                <th className="text-right px-3 py-2">Cobertura</th>
                <th className="text-right px-3 py-2">Necessidade</th>
                {GRADES.map((g) => <th key={g} className="text-right px-2 py-2">{g}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={16} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={16} className="p-8 text-center text-muted-foreground">Sem produtos cadastrados.</td></tr>}
              {rows.slice(0, 100).map((r) => (
                <tr key={r.product_id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className={`inline-block size-2.5 rounded-full ${r.status === "red" ? "bg-destructive" : r.status === "yellow" ? "bg-warning" : "bg-success"}`} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{r.name}<div className="text-[10px] text-muted-foreground">{r.collection ?? "—"}</div></td>
                  <td className="px-3 py-2 text-right">{r.stock}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.minimum}</td>
                  <td className="px-3 py-2 text-right">{r.sold30}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.producing}</td>
                  <td className="px-3 py-2 text-right">{r.coverage > 365 ? "∞" : `${r.coverage}d`}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.need}</td>
                  {GRADES.map((g) => <td key={g} className="px-2 py-2 text-right text-xs text-muted-foreground">{r.byGrade[g] ?? 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, icon, tone }: { label: string; value: number | string; icon?: React.ReactNode; tone: "red" | "yellow" | "green" | "primary" }) {
  const tones = {
    red: "border-destructive/40 text-destructive",
    yellow: "border-warning/40 text-warning",
    green: "border-success/40 text-success",
    primary: "border-primary/40 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 bg-card ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
