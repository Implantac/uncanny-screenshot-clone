import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Boxes, AlertTriangle, Skull, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/stock-health")({
  component: StockHealth,
});

type Item = {
  id: string;
  sku: string;
  name: string;
  category: string;
  deposit: string | null;
  balance: number;
  minimum: number;
  sold30: number;
  coverage: number;
  ageDays: number;
  status: "ok" | "baixo" | "ruptura" | "morto" | "excesso";
};

async function load(): Promise<Item[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: inv }, { data: sales }] = await Promise.all([
    supabase.from("inventory_items").select("*"),
    supabase.from("sales").select("sku, quantity, sold_at").gte("sold_at", since),
  ]);
  const soldBySku = new Map<string, number>();
  (sales ?? []).forEach((s) => {
    if (s.sku) soldBySku.set(s.sku, (soldBySku.get(s.sku) ?? 0) + s.quantity);
  });

  const now = Date.now();
  return (inv ?? [])
    .map((i) => {
      const balance = Number(i.balance);
      const minimum = Number(i.minimum);
      const sold30 = soldBySku.get(i.sku) ?? 0;
      const daily = sold30 / 30;
      const coverage = daily > 0 ? Math.floor(balance / daily) : 999;
      const ageDays = Math.floor((now - new Date(i.updated_at).getTime()) / 86400000);
      const status: Item["status"] =
        balance <= 0
          ? "ruptura"
          : sold30 === 0 && ageDays > 90
            ? "morto"
            : balance < minimum
              ? "baixo"
              : coverage > 180
                ? "excesso"
                : "ok";
      return {
        id: i.id,
        sku: i.sku,
        name: i.name,
        category: i.category,
        deposit: i.deposit,
        balance,
        minimum,
        sold30,
        coverage,
        ageDays,
        status,
      };
    })
    .sort((a, b) => {
      const order = { ruptura: 0, baixo: 1, morto: 2, excesso: 3, ok: 4 };
      return order[a.status] - order[b.status];
    });
}

function StockHealth() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ["stock-health"], queryFn: load });

  const summary = useMemo(
    () => ({
      total: items.length,
      ruptura: items.filter((i) => i.status === "ruptura").length,
      baixo: items.filter((i) => i.status === "baixo").length,
      morto: items.filter((i) => i.status === "morto").length,
      excesso: items.filter((i) => i.status === "excesso").length,
    }),
    [items],
  );

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Stock Health</h1>
        <p className="text-sm text-muted-foreground">
          Saúde do estoque: ruptura, baixo, morto, excesso e cobertura por SKU.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Itens" value={summary.total} icon={<Package className="size-4" />} />
        <KPI
          label="Ruptura"
          value={summary.ruptura}
          icon={<AlertTriangle className="size-4" />}
          tone="destructive"
        />
        <KPI
          label="Abaixo do mínimo"
          value={summary.baixo}
          icon={<AlertTriangle className="size-4" />}
          tone="warning"
        />
        <KPI
          label="Estoque morto"
          value={summary.morto}
          icon={<Skull className="size-4" />}
          tone="muted"
        />
        <KPI
          label="Excesso"
          value={summary.excesso}
          icon={<Boxes className="size-4" />}
          tone="primary"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-left px-3 py-2">Depósito</th>
                <th className="text-right px-3 py-2">Saldo</th>
                <th className="text-right px-3 py-2">Mín</th>
                <th className="text-right px-3 py-2">Vendido 30d</th>
                <th className="text-right px-3 py-2">Cobertura</th>
                <th className="text-right px-3 py-2">Idade</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Sem itens cadastrados.
                  </td>
                </tr>
              )}
              {items.slice(0, 200).map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Badge status={i.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{i.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground capitalize">
                    {i.category}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i.deposit ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{i.balance}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{i.minimum}</td>
                  <td className="px-3 py-2 text-right">{i.sold30}</td>
                  <td className="px-3 py-2 text-right">
                    {i.coverage > 365 ? "∞" : `${i.coverage}d`}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {i.ageDays}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Badge({ status }: { status: Item["status"] }) {
  const map = {
    ruptura: ["bg-destructive/15 text-destructive", "Ruptura"],
    baixo: ["bg-warning/15 text-warning", "Baixo"],
    morto: ["bg-muted text-muted-foreground", "Morto"],
    excesso: ["bg-primary/15 text-primary", "Excesso"],
    ok: ["bg-success/15 text-success", "OK"],
  } as const;
  const [cls, label] = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function KPI({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "destructive" | "warning" | "primary" | "muted";
}) {
  const tones = {
    default: "",
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-primary",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}
