import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { ShoppingCart, AlertTriangle, Package, TrendingDown } from "lucide-react";
import { InventorySmartPanel } from "@/components/inventory-smart-panel-lazy";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

export const Route = createFileRoute("/_authenticated/_app/compras")({
  head: () => ({
    meta: [
      { title: "Compras · USE MODA PLM" },
      { name: "description", content: "Ordens de compra, cotações, follow-up de fornecedores e recebimento de materiais." },
      { property: "og:title", content: "Compras · USE MODA PLM" },
      { property: "og:description", content: "Ordens de compra, cotações, follow-up de fornecedores e recebimento de materiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compras,
});

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

type Supplier = { id: string; name: string; category: string | null };

async function load() {
  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, sku, name, category, deposit, unit, balance, minimum")
      .order("balance", { ascending: true }),
    supabase.from("suppliers").select("id, name, category"),
  ]);
  return { items: (items ?? []) as Item[], suppliers: (suppliers ?? []) as Supplier[] };
}

function Compras() {
  const { data, isLoading } = useQuery({ queryKey: ["compras"], queryFn: load });
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const suppliers = useMemo(() => data?.suppliers ?? [], [data?.suppliers]);

  const needs = useMemo(
    () =>
      items
        .filter((i) => Number(i.balance) <= Number(i.minimum))
        .map((i) => {
          const shortage = Math.max(0, Number(i.minimum) - Number(i.balance));
          const suggested = Math.ceil(Math.max(shortage * 1.5, Number(i.minimum) * 0.5));
          return { ...i, shortage, suggested };
        }),
    [items],
  );

  const summary = useMemo(
    () => ({
      needs: needs.length,
      critical: needs.filter((n) => Number(n.balance) === 0).length,
      suppliers: suppliers.length,
      skus: items.length,
    }),
    [needs, suppliers, items],
  );

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
      <PageHeader
        eyebrow="Suprimentos"
        title="Compras"
        description="Necessidades de reposição, cotações e comparativo de fornecedores."
      />


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label="Itens p/ comprar"
          value={summary.needs}
          icon={<ShoppingCart className="size-4" />}
          tone="primary"
        />
        <KPI
          label="Críticos (zero)"
          value={summary.critical}
          icon={<AlertTriangle className="size-4" />}
          tone="destructive"
        />
        <KPI label="SKUs cadastrados" value={summary.skus} icon={<Package className="size-4" />} />
        <KPI
          label="Fornecedores"
          value={summary.suppliers}
          icon={<TrendingDown className="size-4" />}
        />
      </div>

      <InventorySmartPanel />

      <NeedsTable needs={needs} loading={isLoading} />

      <CategoriesTable rows={bySupplierCategory} />
    </div>
  );
}

type Need = Item & { shortage: number; suggested: number };

function NeedsTable({ needs, loading }: { needs: Need[]; loading: boolean }) {
  const columns: DataTableColumn<Need>[] = [
    {
      key: "sku",
      header: "SKU",
      value: (r) => r.sku,
      cell: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: "name",
      header: "Item",
      value: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "category",
      header: "Categoria",
      value: (r) => r.category,
      cell: (r) => <span className="text-muted-foreground">{r.category}</span>,
    },
    {
      key: "deposit",
      header: "Depósito",
      value: (r) => r.deposit ?? "",
      cell: (r) => <span className="text-muted-foreground">{r.deposit ?? "—"}</span>,
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      value: (r) => Number(r.balance),
      cell: (r) => (
        <span
          className={`tabular-nums ${Number(r.balance) === 0 ? "text-destructive font-semibold" : ""}`}
        >
          {Number(r.balance).toFixed(0)} {r.unit}
        </span>
      ),
    },
    {
      key: "minimum",
      header: "Mínimo",
      align: "right",
      value: (r) => Number(r.minimum),
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {Number(r.minimum).toFixed(0)}
        </span>
      ),
    },
    {
      key: "suggested",
      header: "Sugestão",
      align: "right",
      value: (r) => r.suggested,
      cell: (r) => (
        <span className="tabular-nums font-semibold text-primary">
          {r.suggested} {r.unit}
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-2">
      <div className="text-sm font-medium">Necessidade de compra</div>
      <DataTable
        data={needs}
        columns={columns}
        loading={loading}
        getRowId={(r) => r.id}
        initialSort={{ key: "balance", dir: "asc" }}
        searchPlaceholder="Buscar por SKU, item, categoria…"
        emptyTitle="Sem necessidades de compra"
        emptyDescription="Todo o estoque está acima do mínimo no momento."
        emptyIcon={ShoppingCart}
        pageSize={25}
      />
    </section>
  );
}

type CategoryRow = { category: string; count: number; suppliers: number };

function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const columns: DataTableColumn<CategoryRow>[] = [
    {
      key: "category",
      header: "Categoria",
      value: (r) => r.category,
      cell: (r) => <span className="font-medium capitalize">{r.category}</span>,
    },
    {
      key: "suppliers",
      header: "Fornecedores",
      align: "right",
      value: (r) => r.suppliers,
      cell: (r) => <span className="tabular-nums">{r.suppliers}</span>,
    },
    {
      key: "count",
      header: "SKUs em estoque",
      align: "right",
      value: (r) => r.count,
      cell: (r) => <span className="tabular-nums">{r.count}</span>,
    },
  ];

  return (
    <section className="space-y-2">
      <div className="text-sm font-medium">Mapa de fornecedores por categoria</div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.category}
        initialSort={{ key: "count", dir: "desc" }}
        searchPlaceholder="Buscar categoria…"
        emptyTitle="Sem categorias mapeadas"
      />
    </section>
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
  tone?: "default" | "primary" | "destructive";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
