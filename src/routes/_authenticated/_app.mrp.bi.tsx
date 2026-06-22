import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, TrendingUp, Activity, Layers, Truck, Boxes, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import { computeMrpPlanning, type MrpRow } from "@/lib/mrp-planning.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/mrp/bi")({
  head: () => ({
    meta: [
      { title: "BI MRP · USE MODA PLM" },
      {
        name: "description",
        content: "Curva ABC, XYZ, cobertura, capital parado, lead time e top consumos do MRP.",
      },
    ],
  }),
  component: MrpBiPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

type AbcClass = "A" | "B" | "C";
type XyzClass = "X" | "Y" | "Z";

function classifyAbc(rows: MrpRow[]): Map<string, { cls: AbcClass; value: number; pct: number; cum: number }> {
  const sorted = [...rows]
    .map((r) => ({ id: r.id, value: r.annualDemand * r.avgUnitCost }))
    .sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, r) => a + r.value, 0) || 1;
  const map = new Map<string, { cls: AbcClass; value: number; pct: number; cum: number }>();
  let cum = 0;
  for (const r of sorted) {
    cum += r.value;
    const cumPct = (cum / total) * 100;
    const cls: AbcClass = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
    map.set(r.id, { cls, value: r.value, pct: (r.value / total) * 100, cum: cumPct });
  }
  return map;
}

function classifyXyz(r: MrpRow): XyzClass {
  const mean = r.annualDemand / 12;
  if (mean <= 0) return "Z";
  const cv = r.stdDev / mean;
  if (cv <= 0.5) return "X";
  if (cv <= 1) return "Y";
  return "Z";
}

function MrpBiPage() {
  const computeFn = useServerFn(computeMrpPlanning);
  const { data, isLoading } = useQuery({
    queryKey: ["mrp-planning", {}],
    queryFn: () => computeFn({ data: {} }),
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];

  const abc = useMemo(() => classifyAbc(rows), [rows]);

  const abcSummary = useMemo(() => {
    const buckets = { A: { count: 0, value: 0 }, B: { count: 0, value: 0 }, C: { count: 0, value: 0 } };
    for (const r of rows) {
      const a = abc.get(r.id);
      if (!a) continue;
      buckets[a.cls].count += 1;
      buckets[a.cls].value += a.value;
    }
    return buckets;
  }, [rows, abc]);

  const xyzSummary = useMemo(() => {
    const buckets = { X: 0, Y: 0, Z: 0 };
    for (const r of rows) buckets[classifyXyz(r)] += 1;
    return buckets;
  }, [rows]);

  const matrix = useMemo(() => {
    // ABC × XYZ
    const m: Record<string, number> = {};
    for (const r of rows) {
      const a = abc.get(r.id)?.cls ?? "C";
      const x = classifyXyz(r);
      const key = `${a}${x}`;
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  }, [rows, abc]);

  const topConsumo = useMemo(
    () =>
      [...rows]
        .map((r) => ({ ...r, valor: r.annualDemand * r.avgUnitCost }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10),
    [rows],
  );

  const topCapital = useMemo(
    () => [...rows].sort((a, b) => b.capitalEmpatado - a.capitalEmpatado).slice(0, 10),
    [rows],
  );

  const leadTimes = useMemo(() => {
    const m = new Map<string, { name: string; total: number; sum: number; items: number }>();
    for (const r of rows) {
      const key = r.supplierName ?? "(sem fornecedor)";
      const cur = m.get(key) ?? { name: key, total: 0, sum: 0, items: 0 };
      cur.sum += r.leadTimeDays;
      cur.items += 1;
      cur.total += r.capitalEmpatado;
      m.set(key, cur);
    }
    return Array.from(m.values())
      .map((s) => ({ ...s, avg: s.sum / s.items }))
      .sort((a, b) => b.items - a.items)
      .slice(0, 10);
  }, [rows]);

  const coverageByCategory = useMemo(() => {
    const m = new Map<string, { cat: string; sum: number; items: number; capital: number }>();
    for (const r of rows) {
      const key = r.category ?? "(sem categoria)";
      const cur = m.get(key) ?? { cat: key, sum: 0, items: 0, capital: 0 };
      if (r.coverageDays !== null) {
        cur.sum += r.coverageDays;
        cur.items += 1;
      }
      cur.capital += r.capitalEmpatado;
      m.set(key, cur);
    }
    return Array.from(m.values())
      .map((c) => ({ ...c, avg: c.items > 0 ? c.sum / c.items : 0 }))
      .sort((a, b) => b.capital - a.capital);
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/mrp">
                <ArrowLeft className="h-4 w-4 mr-1" /> MRP
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold">BI MRP</h1>
          <p className="text-sm text-muted-foreground">
            Curva ABC, XYZ, cobertura, lead time, giro e top consumos.
          </p>
        </div>
      </div>

      {/* KPIs ABC × XYZ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["A", "B", "C"] as const).map((k) => (
          <div key={k} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" /> Curva {k}
            </div>
            <div className="text-2xl font-bold mt-1">{abcSummary[k].count}</div>
            <div className="text-xs text-muted-foreground">
              SKUs · {brl(abcSummary[k].value)} em demanda anual
            </div>
          </div>
        ))}
      </div>

      {/* Matriz ABC × XYZ */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4" />
          <h2 className="font-semibold">Matriz ABC × XYZ</h2>
          <span className="text-xs text-muted-foreground ml-2">
            X = demanda estável (CV ≤ 0,5) · Y = média · Z = errática
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 px-3"></th>
                <th className="py-2 px-3">X (estável)</th>
                <th className="py-2 px-3">Y (média)</th>
                <th className="py-2 px-3">Z (errática)</th>
                <th className="py-2 px-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {(["A", "B", "C"] as const).map((a) => {
                const tot = (matrix[`${a}X`] ?? 0) + (matrix[`${a}Y`] ?? 0) + (matrix[`${a}Z`] ?? 0);
                return (
                  <tr key={a} className="border-b">
                    <td className="py-2 px-3 font-medium">{a}</td>
                    {(["X", "Y", "Z"] as const).map((x) => (
                      <td key={x} className="py-2 px-3">
                        {matrix[`${a}${x}`] ?? 0}
                      </td>
                    ))}
                    <td className="py-2 px-3 font-medium">{tot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          AX = alto valor e estável (ideal para automação MRP) · CZ = baixo valor e errático (revisar
          se vale manter)
        </div>
      </div>

      {/* Top consumos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4" />
            <h2 className="font-semibold">Top 10 consumos anuais (R$)</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topConsumo} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => brl(Number(v))} fontSize={11} />
              <YAxis type="category" dataKey="sku" width={80} fontSize={11} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="h-4 w-4" />
            <h2 className="font-semibold">Top 10 capital empatado</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCapital} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => brl(Number(v))} fontSize={11} />
              <YAxis type="category" dataKey="sku" width={80} fontSize={11} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="capitalEmpatado">
                {topCapital.map((r, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      r.status === "excesso"
                        ? "hsl(217 91% 60%)"
                        : r.status === "critico"
                          ? "hsl(0 84% 60%)"
                          : "hsl(var(--primary))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lead time por fornecedor */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-4 w-4" />
          <h2 className="font-semibold">Lead time por fornecedor</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 px-3">Fornecedor</th>
                <th className="py-2 px-3 text-right">Itens</th>
                <th className="py-2 px-3 text-right">Lead time médio</th>
                <th className="py-2 px-3 text-right">Capital</th>
              </tr>
            </thead>
            <tbody>
              {leadTimes.map((s) => (
                <tr key={s.name} className="border-b last:border-0">
                  <td className="py-2 px-3 font-medium">{s.name}</td>
                  <td className="py-2 px-3 text-right">{s.items}</td>
                  <td className="py-2 px-3 text-right">{num(s.avg, 1)} dias</td>
                  <td className="py-2 px-3 text-right">{brl(s.total)}</td>
                </tr>
              ))}
              {leadTimes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">
                    Sem dados de fornecedor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cobertura por categoria */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="font-semibold">Cobertura média e capital por categoria</h2>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={coverageByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cat" fontSize={11} angle={-20} textAnchor="end" height={70} />
            <YAxis yAxisId="left" fontSize={11} />
            <YAxis yAxisId="right" orientation="right" fontSize={11} tickFormatter={(v) => brl(Number(v))} />
            <Tooltip
              formatter={(v: number, name: string) =>
                name === "Capital" ? brl(v) : `${num(v, 1)} dias`
              }
            />
            <Legend />
            <Bar yAxisId="left" dataKey="avg" name="Cobertura (dias)" fill="hsl(var(--primary))" />
            <Bar yAxisId="right" dataKey="capital" name="Capital" fill="hsl(38 92% 50%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
