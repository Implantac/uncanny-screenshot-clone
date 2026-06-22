import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  Loader2,
  PackageX,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  getCollectionAbc,
  listCollectionsForAbc,
  type AbcClass,
  type AbcItem,
} from "@/lib/abc-collection.functions";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/abc-colecao")({
  component: AbcCollectionPage,
  head: () => ({
    meta: [{ title: "Curva ABC por Coleção · USE MODA PLM" }],
  }),
});

const CLASS_TINT: Record<AbcClass, string> = {
  A: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  B: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  C: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const PCT = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function AbcCollectionPage() {
  const listFn = useServerFn(listCollectionsForAbc);
  const abcFn = useServerFn(getCollectionAbc);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(180);
  const [filterClass, setFilterClass] = useState<AbcClass | "ALL">("ALL");

  const collectionsQ = useQuery({
    queryKey: ["abc", "collections"],
    queryFn: () => listFn(),
  });

  // auto-select first collection (em useEffect para evitar setState durante render)
  useEffect(() => {
    if (!collectionId && collectionsQ.data && collectionsQ.data.length > 0) {
      setCollectionId(collectionsQ.data[0].id);
    }
  }, [collectionId, collectionsQ.data]);

  const abcQ = useQuery({
    queryKey: ["abc", "data", collectionId, windowDays],
    queryFn: () =>
      abcFn({ data: { collectionId: collectionId!, windowDays } }),
    enabled: !!collectionId,
  });

  const items = abcQ.data?.items ?? [];
  const summary = abcQ.data?.summary;
  const filteredItems = useMemo(
    () =>
      filterClass === "ALL"
        ? items
        : items.filter((i) => i.abcClass === filterClass),
    [items, filterClass],
  );

  const insight = useMemo(() => buildInsight(items, summary), [items, summary]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Curva ABC por Coleção
          </h1>
          <p className="text-muted-foreground text-sm">
            Pareto de receita por produto. Identifica os{" "}
            <strong>heróis (A)</strong>, os complementares (B) e os candidatos
            a markdown / descontinuação (C).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={collectionId ?? undefined}
            onValueChange={(v) => setCollectionId(v)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecionar coleção" />
            </SelectTrigger>
            <SelectContent>
              {(collectionsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.season ? ` · ${c.season}` : ""}
                  {c.year ? ` ${c.year}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(windowDays)}
            onValueChange={(v) => setWindowDays(Number(v))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Últimos 365 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {abcQ.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando curva…
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi
              label="Receita total"
              value={BRL.format(summary.totalRevenue)}
              hint={`${summary.totalQty.toLocaleString("pt-BR")} peças`}
            />
            <Kpi
              label="Classe A (heróis)"
              value={`${summary.classCounts.A}`}
              hint={`${PCT(
                summary.totalRevenue
                  ? summary.classRevenue.A / summary.totalRevenue
                  : 0,
              )} da receita`}
              tone="emerald"
            />
            <Kpi
              label="Classe B"
              value={`${summary.classCounts.B}`}
              hint={`${PCT(
                summary.totalRevenue
                  ? summary.classRevenue.B / summary.totalRevenue
                  : 0,
              )} da receita`}
              tone="amber"
            />
            <Kpi
              label="Classe C (cauda)"
              value={`${summary.classCounts.C}`}
              hint={`${PCT(
                summary.totalRevenue
                  ? summary.classRevenue.C / summary.totalRevenue
                  : 0,
              )} da receita`}
              tone="rose"
            />
            <Kpi
              label="Sem venda"
              value={`${summary.productsNoSales}`}
              hint={`de ${summary.productsTotal} produtos`}
              tone="muted"
            />
          </div>

          {insight && (
            <div className="rounded-lg border bg-card p-4 flex gap-3">
              <Sparkles className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <div className="font-medium mb-1">Leitura do PCP</div>
                <p className="text-muted-foreground whitespace-pre-line">
                  {insight}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {(["ALL", "A", "B", "C"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilterClass(k)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  filterClass === k
                    ? "bg-foreground text-background"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {k === "ALL" ? "Todos" : `Classe ${k}`}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredItems.length} produtos
            </span>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">% receita</TableHead>
                  <TableHead className="text-right">% acumul.</TableHead>
                  <TableHead className="text-right">Margem un.</TableHead>
                  <TableHead className="text-center">Classe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((it, idx) => (
                  <TableRow key={it.productId}>
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {it.imageUrl ? (
                          <img
                            src={it.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded object-cover border"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {it.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {it.sku}
                            {it.role !== "linha" && (
                              <span className="ml-1">· {it.role}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.qty.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {BRL.format(it.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {PCT(it.revenueShare)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {PCT(it.cumulativeShare)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.grossMargin != null
                        ? BRL.format(it.grossMargin)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={CLASS_TINT[it.abcClass]}
                      >
                        {it.abcClass}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-10"
                    >
                      Sem produtos nesta classe.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {summary.productsNoSales > 0 && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex items-center gap-2 mb-2 text-rose-700 font-medium">
                <PackageX className="h-4 w-4" />
                {summary.productsNoSales} produtos sem venda na janela
              </div>
              <p className="text-xs text-muted-foreground">
                Candidatos a revisão de preço, push de marketing ou retirada
                do mix da próxima coleção.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "emerald" | "amber" | "rose" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "rose"
          ? "text-rose-600"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function buildInsight(
  items: AbcItem[],
  summary: ReturnType<typeof Object> | any,
): string | null {
  if (!summary || items.length === 0) return null;
  const parts: string[] = [];
  const hero = items[0];
  if (hero && hero.revenue > 0) {
    parts.push(
      `🏆 ${hero.name} (${hero.sku}) é o carro-chefe, com ${PCT(
        hero.revenueShare,
      )} da receita sozinho.`,
    );
  }
  const classA = items.filter((i) => i.abcClass === "A");
  if (classA.length > 0) {
    parts.push(
      `📈 ${classA.length} produtos formam a Classe A e respondem por ${PCT(
        summary.totalRevenue
          ? summary.classRevenue.A / summary.totalRevenue
          : 0,
      )} da receita — proteja estoque e priorize reposição.`,
    );
  }
  const noSales = summary.productsNoSales as number;
  if (noSales > 0) {
    parts.push(
      `⚠️ ${noSales} produtos não venderam nos últimos ${summary.windowDays} dias. Avalie markdown, push de marketing ou descontinuação.`,
    );
  }
  const classC = items.filter(
    (i) => i.abcClass === "C" && i.revenue > 0,
  ).length;
  if (classC > 0 && summary.productsTotal > 0) {
    parts.push(
      `🪓 ${classC} produtos estão na cauda (Classe C) e contribuem com pouco — bons candidatos para enxugar o próximo mix.`,
    );
  }
  return parts.join("\n");
}

// keep tree-shake-safe icon imports used only in JSX hints
void TrendingUp;
void TrendingDown;
void Award;
