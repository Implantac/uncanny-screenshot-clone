import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

/**
 * Extrai pares (rótulo, número) de uma resposta de IA em markdown.
 * Reconhece linhas como:
 *   - Coleção Verão: R$ 124.500
 *   1. Camiseta Slim — 42 pç
 *   • Lote 258 (87%)
 *   * Top X: 1234
 * Mantém só números com unidade reconhecível (R$, %, pç, un, k, mil).
 */
function parseSeries(text: string): { name: string; value: number; raw: string }[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out: { name: string; value: number; raw: string }[] = [];
  const seen = new Set<string>();

  const re =
    /^\s*(?:[-*•]|\d+[.)])\s+(.+?)[\s:\-—–]+(?:R\$\s*)?([\d.,]+)\s*(%|pç|pcs|un|k|mil|milhões?|m)?\b/i;

  for (const ln of lines) {
    const m = ln.match(re);
    if (!m) continue;
    const name = m[1].replace(/[*_`]/g, "").trim().slice(0, 32);
    const numRaw = m[2].replace(/\./g, "").replace(",", ".");
    let value = Number(numRaw);
    if (!isFinite(value)) continue;
    const unit = (m[3] || "").toLowerCase();
    if (unit === "k" || unit === "mil") value *= 1_000;
    if (unit === "m" || unit.startsWith("milh")) value *= 1_000_000;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, value, raw: m[2] + (m[3] ? ` ${m[3]}` : "") });
    if (out.length >= 8) break;
  }
  return out;
}

const PALETTE = [
  "hsl(var(--primary))",
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#84cc16",
];

type TooltipItem = {
  payload?: {
    raw?: string;
  };
};

export function InlineChart({ text }: { text: string }) {
  const data = useMemo(() => parseSeries(text), [text]);
  if (data.length < 2) return null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        <BarChart3 className="size-3" /> Visualização inferida
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={48}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={42} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number, _n, item: TooltipItem) => [item?.payload?.raw ?? v, "valor"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
