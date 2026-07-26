import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Grid3x3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/line-sheet/$id")({
  head: () => ({
    meta: [
      { title: "Line Sheet · USE MODA PLM" },
      {
        name: "description",
        content: "Grade visual da coleção por categoria e preço, pronta para impressão.",
      },
    ],
  }),
  component: LineSheetPage,
});

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  image_url: string | null;
  cost_price: number | null;
  sell_price: number | null;
  status: string | null;
  colors: string[] | null;
  sizes: string[] | null;
};

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function priceTier(sell: number | null | undefined): "entrada" | "medio" | "premium" | "-" {
  if (!sell) return "-";
  if (sell < 200) return "entrada";
  if (sell < 500) return "medio";
  return "premium";
}
const TIER_COLOR: Record<string, string> = {
  entrada: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  medio: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  premium: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "-": "bg-muted text-muted-foreground",
};

function margin(cost: number | null, sell: number | null): number | null {
  if (!cost || !sell || sell === 0) return null;
  return ((sell - cost) / sell) * 100;
}

function LineSheetPage() {
  const { id } = useParams({ from: "/_authenticated/_app/line-sheet/$id" });

  const { data: collection } = useQuery({
    queryKey: ["line-sheet-collection", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, season, year, status")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["line-sheet-products", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, sku, name, category, image_url, cost_price, sell_price, status, colors, sizes",
        )
        .eq("collection_id", id)
        .order("category")
        .order("sell_price", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const k = p.category ?? "Sem categoria";
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const totals = useMemo(() => {
    const skus = products.length;
    const avgSell =
      skus > 0
        ? products.reduce((s, p) => s + (p.sell_price ?? 0), 0) / skus
        : 0;
    const tiers = { entrada: 0, medio: 0, premium: 0 };
    for (const p of products) {
      const t = priceTier(p.sell_price);
      if (t !== "-") tiers[t]++;
    }
    return { skus, avgSell, tiers };
  }, [products]);

  return (
    <div className="p-6 space-y-4 print:p-2">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Coleções"
          title={`Line Sheet · ${collection?.name ?? "…"}`}
          description={
            collection
              ? `${collection.season ?? "—"} ${collection.year ?? ""} · ${products.length} SKUs`
              : "Grade visual da coleção pronta para reunião comercial ou impressão."
          }
          actions={
            <div className="flex gap-2">
              <Link
                to="/colecao-360/$id"
                params={{ id }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="size-3.5" /> Voltar
              </Link>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="size-4 mr-1" /> Imprimir / PDF
              </Button>
            </div>
          }
        />
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">
          {collection?.name} — {collection?.season} {collection?.year}
        </h1>
        <div className="text-sm text-muted-foreground">
          Line Sheet · {products.length} SKUs · Gerado{" "}
          {new Date().toLocaleDateString("pt-BR")}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        <StatCard label="SKUs" value={String(totals.skus)} />
        <StatCard label="Preço médio" value={fmtBRL(totals.avgSell)} />
        <StatCard
          label="Mix de preço"
          value={`${totals.tiers.entrada}E · ${totals.tiers.medio}M · ${totals.tiers.premium}P`}
        />
        <StatCard
          label="Categorias"
          value={String(groups.length)}
          icon={<Grid3x3 className="size-4 text-primary" />}
        />
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">
          Carregando produtos da coleção…
        </div>
      ) : products.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">
          Esta coleção ainda não tem produtos vinculados.
          <div className="mt-2">
            <Link to="/produtos" className="text-primary text-sm hover:underline">
              Cadastrar produto
            </Link>
          </div>
        </div>
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="space-y-2 break-inside-avoid">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider">{cat}</h2>
              <span className="text-xs text-muted-foreground">({items.length} SKUs)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 print:grid-cols-4">
              {items.map((p) => {
                const tier = priceTier(p.sell_price);
                const mg = margin(p.cost_price, p.sell_price);
                return (
                  <Link
                    key={p.id}
                    to="/produto/$id"
                    params={{ id: p.id }}
                    className="block group border border-border rounded-lg overflow-hidden bg-card hover:border-primary/50 transition print:break-inside-avoid"
                  >
                    <div className="aspect-square bg-muted overflow-hidden">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="size-full object-cover group-hover:scale-105 transition"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-full grid place-items-center text-muted-foreground text-xs">
                          sem foto
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {p.sku}
                      </div>
                      <div className="text-xs font-medium line-clamp-2 min-h-[2rem]">
                        {p.name}
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold">{fmtBRL(p.sell_price)}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-4 px-1 ${TIER_COLOR[tier]}`}
                        >
                          {tier}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>custo {fmtBRL(p.cost_price)}</span>
                        <span
                          className={
                            mg == null
                              ? ""
                              : mg >= 50
                                ? "text-emerald-600"
                                : mg >= 30
                                  ? "text-amber-600"
                                  : "text-rose-600"
                          }
                        >
                          {mg == null ? "—" : `${mg.toFixed(0)}%`}
                        </span>
                      </div>
                      {(p.colors ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-0.5 pt-0.5">
                          {(p.colors ?? []).slice(0, 6).map((c) => (
                            <span
                              key={c}
                              className="text-[9px] px-1 rounded bg-muted text-muted-foreground"
                              title={c}
                            >
                              {c.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
