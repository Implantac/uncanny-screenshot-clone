import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Ruler, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/grade-needs")({ component: GradeNeeds });

type Product = { id: string; sku: string; name: string; sizes: string[] | null };
type Sale = { product_id: string | null; size: string | null; quantity: number };

const STANDARD = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

async function load() {
  const [{ data: products }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, sku, name, sizes"),
    supabase.from("sales").select("product_id, size, quantity"),
  ]);
  return { products: (products ?? []) as Product[], sales: (sales ?? []) as Sale[] };
}

function GradeNeeds() {
  const { data, isLoading } = useQuery({ queryKey: ["grade-needs"], queryFn: load });
  const products = data?.products ?? [];
  const sales = data?.sales ?? [];

  const rows = useMemo(() => {
    return products.map((p) => {
      const ps = sales.filter((s) => s.product_id === p.id);
      const sizes = (p.sizes && p.sizes.length > 0) ? p.sizes : STANDARD;
      const bySize: Record<string, number> = {};
      sizes.forEach((sz) => (bySize[sz] = 0));
      ps.forEach((s) => {
        const sz = (s.size ?? "").toUpperCase();
        if (sz && bySize[sz] !== undefined) bySize[sz] += s.quantity;
      });
      const total = Object.values(bySize).reduce((a, b) => a + b, 0);
      // Necessidade sugerida: proporção da grade aplicada a 1 lote típico (max ou 100)
      const target = Math.max(100, total);
      const needs: Record<string, number> = {};
      sizes.forEach((sz) => {
        needs[sz] = total > 0 ? Math.round((bySize[sz] / total) * target) : Math.round(target / sizes.length);
      });
      return { ...p, sizes, bySize, needs, total };
    }).filter((r) => r.total > 0 || (r.sizes.length > 0));
  }, [products, sales]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.sizes.forEach((s) => set.add(s)));
    const ordered = STANDARD.filter((s) => set.has(s));
    Array.from(set).forEach((s) => { if (!ordered.includes(s)) ordered.push(s); });
    return ordered;
  }, [rows]);

  const summary = useMemo(() => ({
    skus: rows.length,
    totalUnits: rows.reduce((s, r) => s + r.total, 0),
    suggested: rows.reduce((s, r) => s + Object.values(r.needs).reduce((a, b) => a + b, 0), 0),
  }), [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Necessidade por Grade</h1>
        <p className="text-sm text-muted-foreground">Quebra PP/P/M/G/GG por SKU baseada no histórico real de vendas.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="SKUs analisados" value={summary.skus} icon={<Ruler className="size-4" />} />
        <KPI label="Unidades vendidas" value={summary.totalUnits.toLocaleString("pt-BR")} icon={<TrendingUp className="size-4" />} />
        <KPI label="Necessidade total" value={summary.suggested.toLocaleString("pt-BR")} icon={<Ruler className="size-4" />} tone="primary" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-muted/40">Produto</th>
              {allSizes.map((sz) => <th key={sz} className="text-right px-3 py-2">{sz}</th>)}
              <th className="text-right px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={allSizes.length + 2} className="p-8 text-center text-muted-foreground">Carregando…</td></tr> :
              rows.length === 0 ? <tr><td colSpan={allSizes.length + 2} className="p-8 text-center text-muted-foreground">Sem dados de grade.</td></tr> :
              rows.slice(0, 50).map((r) => {
                const totalNeed = Object.values(r.needs).reduce((a, b) => a + b, 0);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 sticky left-0 bg-card">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.sku}</div>
                    </td>
                    {allSizes.map((sz) => (
                      <td key={sz} className="px-3 py-2 text-right">
                        {r.needs[sz] !== undefined ? (
                          <div>
                            <div className="font-semibold tabular-nums text-primary">{r.needs[sz]}</div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">vend {r.bySize[sz] ?? 0}</div>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{totalNeed}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" }) {
  const toneCls = tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
