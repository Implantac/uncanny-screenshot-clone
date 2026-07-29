import { useMemo, useState, useCallback, createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSizeGrids } from "@/lib/size-grids.functions";
import { supabase } from "@/integrations/supabase/client";
import { Ruler, ChevronDown, ChevronUp, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Props = {
  productId: string;
  category: string | null;
};

/**
 * Contexto para compartilhar a grade de tamanhos entre
 * o card e o GradeRulePopover aninhado.
 */
const SizesContext = createContext<string[]>([]);

/**
 * ProductSizeGridCard — Card que mostra a grade de tamanhos
 * aplicada ao produto (por categoria ou produto específico).
 * Inclui GradeRulePopover inline para calcular salto automaticamente.
 */
export function ProductSizeGridCard({ productId, category }: Props) {
  const [expanded, setExpanded] = useState(false);
  const list = useServerFn(listSizeGrids);

  const { data: product } = useQuery({
    enabled: !!productId,
    queryKey: ["product-sizes", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("sizes, grade")
        .eq("id", productId)
        .maybeSingle();
      return data as { sizes: string[] | null; grade: string | null } | null;
    },
  });

  const { data: grids } = useQuery({
    queryKey: ["size-grids"],
    queryFn: () => list(),
  });

  const matchedGrid = useMemo(() => {
    if (!grids) return null;
    const productGrid = grids.find(
      (g: any) => g.scope === "product" && g.product_id === productId,
    );
    if (productGrid) return productGrid;
    if (category) {
      const catGrid = grids.find(
        (g: any) => g.scope === "category" && g.scope_value === category,
      );
      if (catGrid) return catGrid;
    }
    return null;
  }, [grids, productId, category]);

  const sizes = product?.sizes ?? [];
  const distribution = matchedGrid?.distribution as Record<string, number> | undefined;
  const totalPct = distribution
    ? Object.values(distribution).reduce((a, b) => a + b, 0)
    : 0;

  if (!sizes.length && !matchedGrid) return null;

  return (
    <SizesContext.Provider value={sizes.length > 0 ? sizes : distribution ? Object.keys(distribution) : []}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Ruler className="size-4 text-primary" />
            <span className="text-sm font-semibold">Grade de Tamanhos</span>
            {matchedGrid && (
              <Badge variant="outline" className="text-[9px]">
                {matchedGrid.scope}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {sizes.length || (distribution ? Object.keys(distribution).length : 0)} tamanhos
            </span>
            {expanded ? (
              <ChevronUp className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            {/* Chips de tamanho + botão de regra de salto */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(sizes.length > 0
                ? sizes
                : distribution
                  ? Object.keys(distribution)
                  : []
              ).map((size) => {
                const pct = distribution?.[size];
                return (
                  <Badge
                    key={size}
                    variant="outline"
                    className="text-[10px] gap-1 px-2 py-0.5"
                  >
                    {size}
                    {pct != null && (
                      <span className="text-muted-foreground font-mono">
                        {(pct * 100).toFixed(0)}%
                      </span>
                    )}
                  </Badge>
                );
              })}
              {sizes.length >= 2 && (
                <InlineGradeRulePopover
                  sizes={sizes}
                  current={Object.fromEntries(sizes.map((s) => [s, 0]))}
                />
              )}
            </div>

            {/* Barra de distribuição */}
            {distribution && totalPct > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {Object.entries(distribution).map(([size, pct]) => (
                  <div
                    key={size}
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(pct / totalPct) * 100}%` }}
                    title={`${size}: ${(pct * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
            )}

            {/* Grade name */}
            {matchedGrid?.notes && (
              <div className="text-[10px] text-muted-foreground italic">
                {matchedGrid.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </SizesContext.Provider>
  );
}

/**
 * GradeRulePopover inline — calcula salto automático entre tamanhos.
 * Integrado ao ProductSizeGridCard para aplicar regras de proporção.
 */
function InlineGradeRulePopover({
  sizes,
  current,
}: {
  sizes: string[];
  current: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const pickDefaultBase = () => {
    if (sizes.includes("M")) return "M";
    return sizes[Math.floor(sizes.length / 2)] ?? sizes[0] ?? "";
  };
  const [base, setBase] = useState<string>(pickDefaultBase());
  const [baseValue, setBaseValue] = useState<string>(
    String(current[pickDefaultBase()] ?? current[sizes[0] ?? ""] ?? 0),
  );
  const [deltas, setDeltas] = useState<string[]>(() =>
    Array(Math.max(0, sizes.length - 1)).fill("2"),
  );

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      const b = sizes.find((s) => s === "M") ?? sizes[Math.floor(sizes.length / 2)] ?? sizes[0] ?? "";
      setBase(b);
      setBaseValue(String(current[b] ?? 0));
      setDeltas((prev) => {
        const n = Math.max(0, sizes.length - 1);
        if (prev.length === n) return prev;
        return Array(n).fill(prev[0] ?? "2");
      });
    }
  };

  const preview = useMemo(() => {
    const result: Record<string, number> = {};
    const idxBase = sizes.indexOf(base);
    if (idxBase < 0 || sizes.length === 0) return result;
    const bv = Number(String(baseValue).replace(",", "."));
    if (!Number.isFinite(bv)) return result;
    result[base] = bv;
    let acc = bv;
    for (let i = idxBase; i < sizes.length - 1; i++) {
      const d = Number(String(deltas[i] ?? "0").replace(",", "."));
      acc = +(acc + (Number.isFinite(d) ? d : 0)).toFixed(2);
      result[sizes[i + 1]] = acc;
    }
    acc = bv;
    for (let i = idxBase; i > 0; i--) {
      const d = Number(String(deltas[i - 1] ?? "0").replace(",", "."));
      acc = +(acc - (Number.isFinite(d) ? d : 0)).toFixed(2);
      result[sizes[i - 1]] = acc;
    }
    return result;
  }, [sizes, base, baseValue, deltas]);

  if (sizes.length < 2) return null;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-6 text-[10px]">
          <WandSparkles className="size-3" />
          Calcular salto
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div>
          <div className="text-xs font-semibold">Regra de salto</div>
          <p className="text-[11px] text-muted-foreground">
            Defina o tamanho base e o incremento entre cada faixa.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 items-end">
          <div>
            <Label className="text-[11px] text-muted-foreground">Base</Label>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Valor (cm)</Label>
            <Input
              value={baseValue}
              onChange={(e) => setBaseValue(e.target.value)}
              className="h-8 text-xs text-right tabular-nums"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Incrementos (cm)</Label>
          {sizes.slice(0, -1).map((s, i) => (
            <div key={`${s}-${sizes[i + 1]}`} className="flex items-center gap-2">
              <span className="text-[11px] font-mono w-20 text-muted-foreground">
                {s} → {sizes[i + 1]}
              </span>
              <Input
                value={deltas[i] ?? ""}
                onChange={(e) => {
                  const next = [...deltas];
                  next[i] = e.target.value;
                  setDeltas(next);
                }}
                className="h-7 text-xs text-right tabular-nums"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border/60 bg-muted/30 p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Prévia</div>
          <div className="grid grid-cols-4 gap-1 text-[11px] tabular-nums">
            {sizes.map((s) => (
              <div
                key={s}
                className={`rounded px-1.5 py-0.5 text-center ${s === base ? "bg-primary/15 text-primary font-semibold" : "bg-background"}`}
              >
                <div className="text-[9px] text-muted-foreground">{s}</div>
                <div>{(preview[s] ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => {
            toast.success("Regra de salto calculada! Use os valores na ficha técnica.");
            setOpen(false);
          }}>
            Aplicar salto
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

