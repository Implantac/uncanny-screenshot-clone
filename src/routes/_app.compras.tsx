import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { ShoppingCart, AlertTriangle, Package, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_app/compras")({ component: Compras });

type Item = {
  id: string;
  sku: string;
  name: string;
  category: string;
  deposit: string | null;
  unit: string;
  balance: number;
  minimum: number;
};

type Supplier = { id: string; name: string; category: string | null; lead_time: number | null };

async function load() {
  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase.from("inventory_items").select("id, sku, name, category, deposit, unit, balance, minimum").order("balance", { ascending: true }),
    supabase.from("suppliers").select("id, name, category, lead_time"),
  ]);
  return { items: (items ?? []) as Item[], suppliers: (suppliers ?? []) as Supplier[] };
}

function Compras() {
  const { data, isLoading } = useQuery({ queryKey: ["compras"], queryFn: load });
  const items = data?.items ?? [];
  const suppliers = data?.suppliers ?? [];

  const needs = useMemo(() => items
    .filter((i) => Number(i.balance) <= Number(i.minimum))
    .map((i) => {
      const shortage = Math.max(0, Number(i.minimum) - Number(i.balance));
      const suggested = Math.ceil(Math.max(shortage * 1.5, Number(i.minimum) * 0.5));
      return { ...i, shortage, suggested };
    }), [items]);

  const summary = useMemo(() => ({
    needs: needs.length,
    critical: needs.filter((n) => Number(n.balance) === 0).length,
    suppliers: suppliers.length,
    skus: items.length,
  }), [needs, suppliers, items]);

  const bySupplierCategory = useMemo(() => {
    const m = new Map<string, { category: string; count: number; suppliers: number }>();
    suppliers.forEach((s) => {
      const c = s.category ?? "Outros";
      const cur = m.get(c) ?? { category: c, count: 0, suppliers: 0 };
      cur.suppliers += 1;
      m.set(c, cur);
    });
    items.forEach((i) => {
      const c = i.category ?? "outros";
      const cur = m.get(c) ?? { category: c, count: 0, suppliers: 0 };
      cur.count += 1;
      m.set(c, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [suppliers, items]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
        <p className="text-sm text-muted-foreground">Necessidades de reposição, cotações e comparativo de fornecedores.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Itens p/ comprar" value={summary.needs} icon={<ShoppingCart className="size-4" />} tone="primary" />
        <KPI label="Críticos (zero)" value={summary.critical} icon={<AlertTriangle className="size-4" />} tone="destructive" />
        <KPI label="SKUs cadastrados" value={summary.skus} icon={<Package className="size-4" />} />
        <KPI label="Fornecedores" value={summary.suppliers} icon={<TrendingDown className="size-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium">Necessidade de compra</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">Categoria</th>
              <th className="text-left px-3 py-2">Depósito</th>
              <th className="text-right px-3 py-2">Saldo</th>
              <th className="text-right px-3 py-2">Mínimo</th>
              <th className="text-right px-3 py-2">Sugestão</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : needs.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem necessidades de compra no momento.</td></tr>
            ) : needs.map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{n.sku}</td>
                <td className="px-3 py-2 font-medium">{n.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{n.category}</td>
                <td className="px-3 py-2 text-muted-foreground">{n.deposit ?? "—"}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${Number(n.balance) === 0 ? "text-destructive font-semibold" : ""}`}>{Number(n.balance).toFixed(0)} {n.unit}</td>
                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{Number(n.minimum).toFixed(0)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{n.suggested} {n.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium">Mapa de fornecedores por categoria</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Categoria</th>
              <th className="text-right px-3 py-2">Fornecedores</th>
              <th className="text-right px-3 py-2">SKUs em estoque</th>
            </tr>
          </thead>
          <tbody>
            {bySupplierCategory.map((c) => (
              <tr key={c.category} className="border-t border-border">
                <td className="px-3 py-2 font-medium capitalize">{c.category}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.suppliers}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
