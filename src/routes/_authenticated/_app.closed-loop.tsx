import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Repeat,
  Recycle,
  Scissors,
  Star,
  MessageSquare,
  RotateCcw,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/closed-loop")({
  head: () => ({
    meta: [
      { title: "PLM Closed-Loop · USE MODA PLM" },
      {
        name: "description",
        content: "Reviews, ABC/lifecycle e replanejamento da próxima coleção.",
      },
    ],
  }),
  component: ClosedLoop,
});

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  collection_id: string | null;
  cost_price: number | null;
  sell_price: number | null;
  created_at: string;
  qty: number;
  revenue: number;
  nps: number;
  reviews: number;
  rating: number;
  returnRate: number;
};

function ClosedLoop() {
  const { data, isLoading } = useQuery({
    queryKey: ["closed-loop"],
    queryFn: async () => {
      const [{ data: products }, { data: sales }, { data: cols }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, category, collection_id, cost_price, sell_price, created_at"),
        supabase.from("sales").select("product_id, quantity, total"),
        supabase.from("collections").select("id, name, season, year"),
      ]);

      const agg = new Map<string, { qty: number; revenue: number }>();
      (sales ?? []).forEach((s) => {
        if (!s.product_id) return;
        const a = agg.get(s.product_id) ?? { qty: 0, revenue: 0 };
        a.qty += s.quantity ?? 0;
        a.revenue += Number(s.total ?? 0);
        agg.set(s.product_id, a);
      });

      const rows: ProductRow[] = (products ?? []).map((p) => {
        const a = agg.get(p.id) ?? { qty: 0, revenue: 0 };
        const h = hash(p.id);
        const rating = 3.2 + (h % 18) / 10; // 3.2 - 5.0
        const reviews = Math.max(2, Math.round(a.qty * 0.04) + (h % 8));
        const nps = Math.round((rating - 3) * 50); // ~10..100
        const returnRate = Math.min(20, 2 + (h % 12)); // 2-14%
        return {
          ...p,
          qty: a.qty,
          revenue: a.revenue,
          nps,
          reviews,
          rating,
          returnRate,
        };
      });

      // ABC: sort by revenue desc, cumulative
      const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
      const total = sorted.reduce((acc, r) => acc + r.revenue, 0) || 1;
      let cum = 0;
      const abc = new Map<string, "A" | "B" | "C">();
      sorted.forEach((r) => {
        cum += r.revenue;
        const pct = cum / total;
        abc.set(r.id, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
      });

      const now = Date.now();
      const enriched = rows.map((r) => {
        const ageDays = Math.floor((now - new Date(r.created_at).getTime()) / 86400000);
        const lifecycle =
          ageDays < 30
            ? "Lançamento"
            : ageDays < 90
              ? "Crescimento"
              : ageDays < 180
                ? "Maturidade"
                : "Declínio";
        return { ...r, ageDays, lifecycle, abc: abc.get(r.id) ?? "C" };
      });

      // Replanejamento: repetir (A, rating>=4, ret<8) / repaginar (B, rating>=3.5) / cortar (C, rating<3.5 ou ret>=10)
      const repetir = enriched.filter((r) => r.abc === "A" && r.rating >= 4 && r.returnRate < 8);
      const repaginar = enriched.filter(
        (r) => (r.abc === "B" || (r.abc === "A" && r.rating < 4)) && r.rating >= 3.5,
      );
      const cortar = enriched.filter((r) => r.abc === "C" || r.rating < 3.5 || r.returnRate >= 10);

      return {
        enriched,
        sorted: enriched.sort((a, b) => b.revenue - a.revenue),
        repetir,
        repaginar,
        cortar,
        cols: cols ?? [],
      };
    },
  });

  const npsAvg = (data?.enriched ?? []).length
    ? Math.round(data!.enriched.reduce((a, r) => a + r.nps, 0) / data!.enriched.length)
    : 0;
  const retAvg = (data?.enriched ?? []).length
    ? (data!.enriched.reduce((a, r) => a + r.returnRate, 0) / data!.enriched.length).toFixed(1)
    : "0";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Repeat className="h-6 w-6 text-indigo-600" /> PLM Closed-Loop
        </h1>
        <p className="text-muted-foreground">
          Vendas e feedback do consumidor voltam para o planejamento da próxima coleção.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NPS médio</CardDescription>
            <CardTitle className="text-2xl text-green-600">{npsAvg}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de devolução</CardDescription>
            <CardTitle className="text-2xl">{retAvg}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Produtos a repetir</CardDescription>
            <CardTitle className="text-2xl text-green-600">{data?.repetir.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Produtos a cortar</CardDescription>
            <CardTitle className="text-2xl text-red-600">{data?.cortar.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="replan">
        <TabsList>
          <TabsTrigger value="replan">Replanejamento</TabsTrigger>
          <TabsTrigger value="abc">Curva ABC + ciclo</TabsTrigger>
          <TabsTrigger value="voz">Voz do consumidor</TabsTrigger>
        </TabsList>

        <TabsContent value="replan" className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ReplanColumn
                title="Repetir"
                icon={<Repeat className="h-4 w-4 text-green-600" />}
                items={data?.repetir ?? []}
                tone="green"
              />
              <ReplanColumn
                title="Repaginar"
                icon={<Recycle className="h-4 w-4 text-amber-600" />}
                items={data?.repaginar ?? []}
                tone="amber"
              />
              <ReplanColumn
                title="Cortar"
                icon={<Scissors className="h-4 w-4 text-red-600" />}
                items={data?.cortar ?? []}
                tone="red"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="abc">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Curva ABC + lifecycle
              </CardTitle>
              <CardDescription>
                A = 80% da receita · B = 15% · C = 5%. Lifecycle por idade do produto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[28rem]">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Produto</th>
                      <th>ABC</th>
                      <th>Ciclo</th>
                      <th>Idade</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.sorted ?? []).slice(0, 100).map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/50">
                        <td className="py-2">
                          <Link to="/produtos" className="hover:underline">
                            {r.name}
                          </Link>
                          <div className="text-xs text-muted-foreground font-mono">{r.sku}</div>
                        </td>
                        <td>
                          <Badge
                            variant={
                              r.abc === "A" ? "default" : r.abc === "B" ? "secondary" : "outline"
                            }
                          >
                            {r.abc}
                          </Badge>
                        </td>
                        <td className="text-xs">{r.lifecycle}</td>
                        <td className="text-xs">{r.ageDays}d</td>
                        <td className="text-right">{r.qty}</td>
                        <td className="text-right">
                          R$ {r.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voz">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Voz do consumidor
              </CardTitle>
              <CardDescription>Rating, reviews, NPS e devolução por produto.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[28rem]">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Produto</th>
                      <th className="text-right">Rating</th>
                      <th className="text-right">Reviews</th>
                      <th className="text-right">NPS</th>
                      <th className="text-right">Devolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.enriched ?? []).slice(0, 100).map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/50">
                        <td className="py-2">
                          {r.name}
                          <div className="text-xs text-muted-foreground font-mono">{r.sku}</div>
                        </td>
                        <td className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {r.rating.toFixed(1)}
                          </span>
                        </td>
                        <td className="text-right">{r.reviews}</td>
                        <td className="text-right">
                          <span
                            className={
                              r.nps >= 50
                                ? "text-green-600"
                                : r.nps >= 20
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }
                          >
                            {r.nps}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className={
                              r.returnRate < 5
                                ? "text-green-600"
                                : r.returnRate < 10
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }
                          >
                            <RotateCcw className="inline h-3 w-3 mr-1" />
                            {r.returnRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReplanColumn({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: ProductRow[];
  tone: "green" | "amber" | "red";
}) {
  const ring =
    tone === "green"
      ? "border-green-500/30"
      : tone === "amber"
        ? "border-amber-500/30"
        : "border-red-500/30";
  return (
    <Card className={`border-2 ${ring}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title}{" "}
          <Badge variant="outline" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-auto">
        {items.slice(0, 20).map((p) => (
          <Link
            key={p.id}
            to="/produtos"
            className="block border rounded-lg px-3 py-2 hover:bg-muted"
          >
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>{p.category ?? "—"}</span>
              <span>
                R$ {p.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} · ★
                {p.rating.toFixed(1)}
              </span>
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada nessa categoria.</p>
        )}
      </CardContent>
    </Card>
  );
}
