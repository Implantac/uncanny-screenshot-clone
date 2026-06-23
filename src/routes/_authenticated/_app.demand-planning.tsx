import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  getPurchaseSuggestionsBySupplier,
  generatePurchaseOrderFromSuggestion,
  recomputeAbcClass,
  ABC_SERVICE_LEVEL,
} from "@/lib/demand-planning.functions";
import {
  listSizeGrids,
  upsertSizeGrid,
  deleteSizeGrid,
  type SizeGridScope,
} from "@/lib/size-grids.functions";
import {
  listSeasonality,
  upsertSeasonality,
  deleteSeasonality,
  SEASON_PRESETS,
  type SeasonalityScope,
} from "@/lib/seasonality.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  RefreshCw,
  Package,
  Factory,
  TrendingUp,
  Calendar,
  Plus,
  Trash2,
  Save,
  ShoppingCart,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RcTooltip } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/demand-planning")({
  component: DemandPlanningPage,
});

const MONTHS_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DemandPlanningPage() {
  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Demand Planning · Grade × Sazonalidade × ABC
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestão de compras por fornecedor, em matriz cor × tamanho, com Z dinâmico (ABC) e fator sazonal aplicado ao consumo.
          </p>
        </div>
        <RecalcAbcButton />
      </header>

      <Tabs defaultValue="purchase">
        <TabsList>
          <TabsTrigger value="purchase">
            <ShoppingCart className="size-4 mr-1.5" /> Sugestão de compras
          </TabsTrigger>
          <TabsTrigger value="grid">
            <Package className="size-4 mr-1.5" /> Grade padrão
          </TabsTrigger>
          <TabsTrigger value="season">
            <Calendar className="size-4 mr-1.5" /> Sazonalidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchase" className="mt-4">
          <PurchaseBySupplierPanel />
        </TabsContent>
        <TabsContent value="grid" className="mt-4">
          <SizeGridEditor />
        </TabsContent>
        <TabsContent value="season" className="mt-4">
          <SeasonalityEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecalcAbcButton() {
  const fn = useServerFn(recomputeAbcClass);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => fn(),
    onSuccess: (r) => {
      toast.success(`ABC recalculado · A:${r.a} B:${r.b} C:${r.c}`);
      qc.invalidateQueries({ queryKey: ["dp-purchase"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao recalcular ABC"),
  });
  return (
    <Button onClick={() => m.mutate()} disabled={m.isPending} variant="outline" size="sm">
      <RefreshCw className={cn("size-4 mr-1.5", m.isPending && "animate-spin")} /> Recalcular curva ABC
    </Button>
  );
}

/* =================== Sugestão de compras =================== */

function PurchaseBySupplierPanel() {
  const fn = useServerFn(getPurchaseSuggestionsBySupplier);
  const { data, isLoading } = useQuery({
    queryKey: ["dp-purchase"],
    queryFn: () => fn(),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Calculando demanda por SKU…</div>;
  const groups = data?.groups ?? [];
  if (groups.length === 0)
    return (
      <Card className="p-8 text-center">
        <Factory className="size-8 mx-auto text-muted-foreground mb-2" />
        <div className="font-medium">Nenhum SKU atingiu o Ponto de Pedido.</div>
        <div className="text-sm text-muted-foreground mt-1">
          Quando a demanda × sazonalidade ultrapassar o ROP, as sugestões aparecerão aqui agrupadas por fornecedor.
        </div>
      </Card>
    );

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <SupplierCard key={g.supplierId ?? "_n"} group={g} />
      ))}
    </div>
  );
}

function SupplierCard({ group }: { group: any }) {
  const fn = useServerFn(generatePurchaseOrderFromSuggestion);
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          supplierId: group.supplierId,
          items: group.products.flatMap((p: any) =>
            p.rows.flatMap((row: any) =>
              p.cols
                .map((col: any) => ({
                  description: `${p.productSku} · ${p.productName} · ${row.name} · ${col.label}`,
                  quantity: p.matrix[row.id]?.[col.id] ?? 0,
                  unitPrice: 0,
                }))
                .filter((it: any) => it.quantity > 0),
            ),
          ),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Pedido ${r.code} criado em rascunho`);
      qc.invalidateQueries({ queryKey: ["dp-purchase"] });
      router.navigate({ to: "/pedidos-compra" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar pedido"),
  });

  return (
    <Card className="p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-md bg-primary/10 grid place-items-center text-sm font-semibold text-primary">
              {(group.supplierName ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-base">{group.supplierName}</div>
              <div className="text-xs text-muted-foreground">{group.products.length} produto(s) com ROP atingido</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total do pedido</div>
            <div className="font-semibold">
              {group.totalQty.toLocaleString("pt-BR")} pç ·{" "}
              {group.totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
            <ShoppingCart className="size-4 mr-1.5" /> Gerar pedido de compra
          </Button>
        </div>
      </header>

      <div className="space-y-5">
        {group.products.map((p: any) => (
          <ProductMatrix key={p.productId} product={p} />
        ))}
      </div>
    </Card>
  );
}

function ProductMatrix({ product }: { product: any }) {
  const classColor: Record<string, string> = {
    A: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    B: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    C: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  };
  const k = product.abcClass ?? "C";
  return (
    <div className="rounded-lg border border-border p-4 bg-card/50">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{product.productName}</span>
          <span className="text-xs text-muted-foreground">{product.productSku}</span>
          {product.abcClass && (
            <Badge variant="outline" className={cn("border", classColor[k])}>
              ABC {product.abcClass} · {ABC_SERVICE_LEVEL[k as "A" | "B" | "C"]}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {product.totalQty.toLocaleString("pt-BR")} pç ·{" "}
          {product.totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-medium py-1.5 px-2">Cor / Tamanho</th>
              {product.cols.map((c: any) => (
                <th key={c.id} className="text-center font-medium py-1.5 px-2 min-w-[56px]">
                  {c.label}
                </th>
              ))}
              <th className="text-right font-medium py-1.5 px-2">Σ</th>
            </tr>
          </thead>
          <tbody>
            {product.rows.map((row: any) => {
              const sum = product.cols.reduce(
                (s: number, c: any) => s + (product.matrix[row.id]?.[c.id] ?? 0),
                0,
              );
              return (
                <tr key={row.id} className="border-t border-border/50">
                  <td className="py-1.5 px-2 flex items-center gap-2">
                    {row.hex && (
                      <span
                        className="size-3 rounded-full border border-border"
                        style={{ background: row.hex }}
                      />
                    )}
                    {row.name}
                  </td>
                  {product.cols.map((c: any) => {
                    const v = product.matrix[row.id]?.[c.id] ?? 0;
                    return (
                      <td
                        key={c.id}
                        className={cn(
                          "text-center py-1.5 px-2 tabular-nums",
                          v === 0 && "text-muted-foreground/40",
                          v > 0 && "font-medium",
                        )}
                      >
                        {v > 0 ? v.toLocaleString("pt-BR") : "—"}
                      </td>
                    );
                  })}
                  <td className="text-right py-1.5 px-2 font-semibold tabular-nums">
                    {sum.toLocaleString("pt-BR")}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-muted/30">
              <td className="py-1.5 px-2 text-xs uppercase tracking-wider text-muted-foreground">Σ</td>
              {product.cols.map((c: any) => {
                const colSum = product.rows.reduce(
                  (s: number, r: any) => s + (product.matrix[r.id]?.[c.id] ?? 0),
                  0,
                );
                return (
                  <td key={c.id} className="text-center py-1.5 px-2 font-semibold tabular-nums">
                    {colSum.toLocaleString("pt-BR")}
                  </td>
                );
              })}
              <td className="text-right py-1.5 px-2 font-semibold tabular-nums">
                {product.totalQty.toLocaleString("pt-BR")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
        <TrendingUp className="size-3.5 mt-0.5 shrink-0" />
        <span>{product.reason}</span>
      </div>
    </div>
  );
}

/* =================== Grade padrão =================== */

function SizeGridEditor() {
  const list = useServerFn(listSizeGrids);
  const upsert = useServerFn(upsertSizeGrid);
  const del = useServerFn(deleteSizeGrid);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["size-grids"], queryFn: () => list() });

  const [draft, setDraft] = useState<{
    scope: SizeGridScope;
    scopeValue: string;
    sizes: { label: string; pct: number }[];
  }>({
    scope: "category",
    scopeValue: "",
    sizes: [
      { label: "P", pct: 10 },
      { label: "M", pct: 40 },
      { label: "G", pct: 40 },
      { label: "GG", pct: 10 },
    ],
  });

  const sum = draft.sizes.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const sumOk = sum >= 95 && sum <= 105;

  const m = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          scope: draft.scope,
          scopeValue: draft.scopeValue,
          distribution: Object.fromEntries(
            draft.sizes.filter((s) => s.label.trim()).map((s) => [s.label.trim(), Number(s.pct) / 100]),
          ),
        },
      }),
    onSuccess: () => {
      toast.success("Grade salva");
      qc.invalidateQueries({ queryKey: ["size-grids"] });
      qc.invalidateQueries({ queryKey: ["dp-purchase"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Grade removida");
      qc.invalidateQueries({ queryKey: ["size-grids"] });
      qc.invalidateQueries({ queryKey: ["dp-purchase"] });
    },
  });

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="font-semibold mb-1">Nova grade</div>
        <div className="text-xs text-muted-foreground mb-4">
          Distribuição % por tamanho aplicada na demanda anual de cada SKU.
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">Escopo</label>
            <Select
              value={draft.scope}
              onValueChange={(v) => setDraft((d) => ({ ...d, scope: v as SizeGridScope }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Categoria</SelectItem>
                <SelectItem value="product_group">Grupo de produto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Valor (ex.: Camisetas)</label>
            <Input
              value={draft.scopeValue}
              onChange={(e) => setDraft((d) => ({ ...d, scopeValue: e.target.value }))}
              placeholder="Camisetas"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left font-medium py-1.5 px-2">Tamanho</th>
                <th className="text-right font-medium py-1.5 px-2">% Venda</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {draft.sizes.map((s, idx) => (
                <tr key={idx} className="border-t border-border/50">
                  <td className="px-2 py-1">
                    <Input
                      value={s.label}
                      onChange={(e) => {
                        const next = [...draft.sizes];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setDraft((d) => ({ ...d, sizes: next }));
                      }}
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={s.pct}
                      onChange={(e) => {
                        const next = [...draft.sizes];
                        next[idx] = { ...next[idx], pct: Number(e.target.value) };
                        setDraft((d) => ({ ...d, sizes: next }));
                      }}
                      className="h-8 text-right"
                    />
                  </td>
                  <td className="px-1">
                    <button
                      onClick={() =>
                        setDraft((d) => ({ ...d, sizes: d.sizes.filter((_, i) => i !== idx) }))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/20">
                <td className="px-2 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">Σ</td>
                <td
                  className={cn(
                    "text-right px-2 py-1.5 font-semibold tabular-nums",
                    sumOk ? "text-emerald-500" : "text-destructive",
                  )}
                >
                  {sum.toFixed(1)}%
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDraft((d) => ({ ...d, sizes: [...d.sizes, { label: "", pct: 0 }] }))
            }
          >
            <Plus className="size-3.5 mr-1" /> Tamanho
          </Button>
          <Button
            size="sm"
            disabled={!draft.scopeValue || !sumOk || m.isPending}
            onClick={() => m.mutate()}
          >
            <Save className="size-3.5 mr-1.5" /> Salvar grade
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="font-semibold mb-3">Grades salvas</div>
        {!data || data.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma grade ainda.</div>
        ) : (
          <div className="space-y-2">
            {data.map((g: any) => (
              <div key={g.id} className="border border-border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">
                    <Badge variant="outline" className="mr-2">{g.scope}</Badge>
                    {g.scope_value || "—"}
                  </div>
                  <button
                    onClick={() => delM.mutate(g.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(g.distribution || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-xs px-2 py-0.5 rounded bg-muted tabular-nums"
                    >
                      {k}: {(Number(v) * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* =================== Sazonalidade =================== */

function SeasonalityEditor() {
  const list = useServerFn(listSeasonality);
  const upsert = useServerFn(upsertSeasonality);
  const del = useServerFn(deleteSeasonality);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["seasonality"], queryFn: () => list() });

  const [draft, setDraft] = useState<{
    scope: SeasonalityScope;
    scopeValue: string;
    months: number[];
  }>({
    scope: "category",
    scopeValue: "",
    months: Array.from({ length: 12 }, () => 1),
  });

  const chartData = useMemo(
    () => draft.months.map((v, i) => ({ m: MONTHS_LABEL[i], v })),
    [draft.months],
  );

  const applyPreset = (k: string) => {
    const preset = SEASON_PRESETS[k];
    if (!preset) return;
    setDraft((d) => ({
      ...d,
      months: Array.from({ length: 12 }, (_, i) => Number(preset[String(i + 1)] ?? 1)),
    }));
  };

  const m = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          scope: draft.scope,
          scopeValue: draft.scopeValue,
          multipliers: Object.fromEntries(
            draft.months.map((v, i) => [String(i + 1), Number(v) || 1]),
          ),
        },
      }),
    onSuccess: () => {
      toast.success("Sazonalidade salva");
      qc.invalidateQueries({ queryKey: ["seasonality"] });
      qc.invalidateQueries({ queryKey: ["dp-purchase"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["seasonality"] });
      qc.invalidateQueries({ queryKey: ["dp-purchase"] });
    },
  });

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold">Nova curva sazonal</div>
            <div className="text-xs text-muted-foreground">
              Multiplica o consumo médio diário no cálculo do Ponto de Pedido.
            </div>
          </div>
          <div className="flex gap-1">
            {Object.keys(SEASON_PRESETS).map((k) => (
              <Button key={k} variant="outline" size="sm" onClick={() => applyPreset(k)}>
                {k}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label className="text-xs text-muted-foreground">Escopo</label>
            <Select
              value={draft.scope}
              onValueChange={(v) => setDraft((d) => ({ ...d, scope: v as SeasonalityScope }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Categoria</SelectItem>
                <SelectItem value="product_group">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Valor (ex.: Casacos)</label>
            <Input
              value={draft.scopeValue}
              onChange={(e) => setDraft((d) => ({ ...d, scopeValue: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2 mb-4">
          {draft.months.map((v, i) => {
            const warn = v > 3;
            return (
              <div key={i}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {MONTHS_LABEL[i]}
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={5}
                  value={v}
                  onChange={(e) => {
                    const next = [...draft.months];
                    next[i] = Number(e.target.value);
                    setDraft((d) => ({ ...d, months: next }));
                  }}
                  className={cn("h-8 text-center text-sm", warn && "border-amber-500")}
                />
              </div>
            );
          })}
        </div>

        <div className="h-32 -ml-2 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="m" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <RcTooltip />
              <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-end">
          <Button size="sm" disabled={!draft.scopeValue || m.isPending} onClick={() => m.mutate()}>
            <Save className="size-3.5 mr-1.5" /> Salvar curva
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="font-semibold mb-3">Curvas salvas</div>
        {!data || data.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma curva ainda.</div>
        ) : (
          <div className="space-y-3">
            {data.map((s: any) => {
              const months = Array.from({ length: 12 }, (_, i) => ({
                m: MONTHS_LABEL[i],
                v: Number(s.multipliers?.[String(i + 1)] ?? 1),
              }));
              return (
                <div key={s.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm font-medium">
                      <Badge variant="outline" className="mr-2">{s.scope}</Badge>
                      {s.scope_value || "—"}
                    </div>
                    <button
                      onClick={() => delM.mutate(s.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="h-20 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={months}>
                        <XAxis dataKey="m" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <Bar dataKey="v" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
