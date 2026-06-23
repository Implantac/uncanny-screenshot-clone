import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartBar, Factory, Truck, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";

const SECTOR_LABEL: Record<string, string> = {
  cad: "CAD",
  modelagem: "Modelagem",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  controle_qualidade: "Qualidade",
  silk: "Silk",
  lavanderia: "Lavanderia",
  embalagem: "Embalagem",
};

const KIND_NEGATIVE = new Set([
  "negativa",
  "falta_material",
  "erro_corte",
  "erro_costura",
  "defeito",
  "retrabalho",
  "atraso",
]);

type Occ = {
  id: string;
  sector: string | null;
  kind: string;
  status: string;
  affected_qty: number | null;
  order_id: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  code: string;
  supplier_id: string | null;
  product_id: string | null;
};

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; sku: string | null };

/**
 * Pareto de ocorrências negativas dos últimos 60 dias:
 * - top setores (causa por onde a fábrica mais sangra)
 * - top fornecedores (quem mais devolve com defeito)
 * - top produtos reincidentes (gate de reincidência)
 *
 * Tudo vem de `production_occurrences` + join leve em `production_orders`,
 * sem mock. Foco: dizer onde abrir a próxima CAPA primeiro.
 */
export function OccurrencesParetoPanel({ windowDays = 60 }: { windowDays?: number }) {
  useRealtime("production_occurrences", ["occ-pareto"]);

  const { data, isLoading } = useQuery({
    queryKey: ["occ-pareto", windowDays],
    queryFn: async () => {
      const since = new Date(Date.now() - windowDays * 86400000).toISOString();
      const { data: occs, error } = await supabase
        .from("production_occurrences")
        .select("id, sector, kind, status, affected_qty, order_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1500);
      if (error) throw error;
      const list = (occs ?? []) as Occ[];
      const negs = list.filter((o) => KIND_NEGATIVE.has(o.kind));
      const orderIds = Array.from(new Set(negs.map((o) => o.order_id).filter(Boolean) as string[]));

      let orders: OrderRow[] = [];
      let suppliers: Supplier[] = [];
      let products: Product[] = [];
      if (orderIds.length > 0) {
        const { data: ord } = await supabase
          .from("production_orders")
          .select("id, code, supplier_id, product_id")
          .in("id", orderIds);
        orders = (ord ?? []) as OrderRow[];
        const supIds = Array.from(
          new Set(orders.map((o) => o.supplier_id).filter(Boolean) as string[]),
        );
        const prodIds = Array.from(
          new Set(orders.map((o) => o.product_id).filter(Boolean) as string[]),
        );
        if (supIds.length > 0) {
          const { data: s } = await supabase
            .from("suppliers")
            .select("id, name")
            .in("id", supIds);
          suppliers = (s ?? []) as Supplier[];
        }
        if (prodIds.length > 0) {
          const { data: p } = await supabase
            .from("products")
            .select("id, name, sku")
            .in("id", prodIds);
          products = (p ?? []) as Product[];
        }
      }
      return { negs, orders, suppliers, products };
    },
    refetchInterval: 120_000,
  });

  const view = useMemo(() => {
    if (!data) return null;
    const { negs, orders, suppliers, products } = data;
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const bySector = new Map<string, { count: number; qty: number }>();
    const bySupplier = new Map<string, { name: string; count: number; qty: number }>();
    const byProduct = new Map<
      string,
      { name: string; sku: string | null; count: number; qty: number; open: number }
    >();

    for (const o of negs) {
      const sec = o.sector ?? "outro";
      const sCur = bySector.get(sec) ?? { count: 0, qty: 0 };
      sCur.count += 1;
      sCur.qty += Number(o.affected_qty ?? 0);
      bySector.set(sec, sCur);

      const ord = o.order_id ? orderMap.get(o.order_id) : null;
      if (ord?.supplier_id) {
        const sup = supMap.get(ord.supplier_id);
        const cur = bySupplier.get(ord.supplier_id) ?? {
          name: sup?.name ?? "—",
          count: 0,
          qty: 0,
        };
        cur.count += 1;
        cur.qty += Number(o.affected_qty ?? 0);
        bySupplier.set(ord.supplier_id, cur);
      }
      if (ord?.product_id) {
        const p = prodMap.get(ord.product_id);
        const cur = byProduct.get(ord.product_id) ?? {
          name: p?.name ?? "—",
          sku: p?.sku ?? null,
          count: 0,
          qty: 0,
          open: 0,
        };
        cur.count += 1;
        cur.qty += Number(o.affected_qty ?? 0);
        if (o.status !== "resolvida") cur.open += 1;
        byProduct.set(ord.product_id, cur);
      }
    }

    const totalCount = negs.length;
    const totalQty = negs.reduce((s, o) => s + Number(o.affected_qty ?? 0), 0);

    const sectorRows = Array.from(bySector.entries())
      .map(([k, v]) => ({ key: k, label: SECTOR_LABEL[k] ?? k, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const supplierRows = Array.from(bySupplier.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recurrentProducts = Array.from(byProduct.entries())
      .map(([id, v]) => ({ id, ...v }))
      .filter((p) => p.count >= 2) // reincidência: 2+ no período
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { totalCount, totalQty, sectorRows, supplierRows, recurrentProducts };
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ChartBar className="size-4 text-primary" /> Pareto de ocorrências · últimos {windowDays} dias
        </CardTitle>
        <CardDescription>
          Onde a fábrica mais sangra. Use para priorizar a próxima CAPA — quem reincide vai pro
          topo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !view ? (
          <div className="h-32 animate-pulse rounded bg-muted/30" />
        ) : view.totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma ocorrência negativa nos últimos {windowDays} dias. 🎉
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Ocorrências" value={view.totalCount} tone="warn" />
              <Stat label="Peças afetadas" value={view.totalQty} tone="danger" />
              <Stat
                label="Reincidentes"
                value={view.recurrentProducts.length}
                tone={view.recurrentProducts.length > 0 ? "danger" : "ok"}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ParetoList
                title="Top setores"
                icon={Factory}
                rows={view.sectorRows.map((r) => ({
                  key: r.key,
                  label: r.label,
                  count: r.count,
                  qty: r.qty,
                }))}
                total={view.totalCount}
              />
              <ParetoList
                title="Top fornecedores"
                icon={Truck}
                rows={view.supplierRows.map((r) => ({
                  key: r.id,
                  label: r.name,
                  count: r.count,
                  qty: r.qty,
                }))}
                total={view.totalCount}
              />
            </div>

            {view.recurrentProducts.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-amber-500" /> Produtos reincidentes ·
                  gate de CAPA
                </div>
                <div className="space-y-1.5">
                  {view.recurrentProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-muted-foreground">
                          {p.sku ? `${p.sku} · ` : ""}
                          {p.count} ocorrências · {p.qty} pç afetadas
                          {p.open > 0 ? ` · ${p.open} aberta(s)` : ""}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-500"
                      >
                        reincidente
                      </Badge>
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-destructive/30 text-destructive"
      : tone === "warn"
        ? "border-amber-500/30 text-amber-500"
        : "border-success/30 text-success";
  return (
    <div className={`rounded-md border bg-card/50 p-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ParetoList({
  title,
  icon: Icon,
  rows,
  total,
}: {
  title: string;
  icon: typeof Factory;
  rows: { key: string; label: string; count: number; qty: number }[];
  total: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        <Icon className="size-3.5" /> {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.count} · {pct}%
                  </span>
                </div>
                <Progress value={pct} className="h-1.5 mt-0.5" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
