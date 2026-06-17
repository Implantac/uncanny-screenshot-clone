import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, ArrowRight } from "lucide-react";

type Collection = { id: string; name: string; season: string | null; year: number | null; created_at: string; launch_date: string | null };

type Stats = {
  products: number;
  avgCost: number;
  avgPrice: number;
  avgMarginPct: number;
  prototypes: number;
  prototypesApproved: number;
  approvalPct: number;
  ops: number;
  opsConcluidas: number;
  conclusionPct: number;
  timeToMarketDays: number | null;
};

const EMPTY: Stats = {
  products: 0, avgCost: 0, avgPrice: 0, avgMarginPct: 0,
  prototypes: 0, prototypesApproved: 0, approvalPct: 0,
  ops: 0, opsConcluidas: 0, conclusionPct: 0, timeToMarketDays: null,
};

async function loadStats(collection: Collection): Promise<Stats> {
  const { data: products = [] } = await supabase
    .from("products")
    .select("id, cost_price, sell_price")
    .eq("collection_id", collection.id);

  const ids = (products ?? []).map((p) => p.id);
  if (ids.length === 0) return EMPTY;

  const [{ data: protos = [] }, { data: ops = [] }] = await Promise.all([
    supabase.from("prototypes").select("id, stage").in("product_id", ids),
    supabase.from("production_orders").select("id, status, created_at").in("product_id", ids),
  ]);

  const costs = (products ?? []).map((p) => Number(p.cost_price || 0)).filter((n) => n > 0);
  const prices = (products ?? []).map((p) => Number(p.sell_price || 0)).filter((n) => n > 0);
  const margins = (products ?? [])
    .map((p) => {
      const c = Number(p.cost_price || 0), s = Number(p.sell_price || 0);
      if (!s) return null;
      return ((s - c) / s) * 100;
    })
    .filter((n): n is number => n !== null);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const approved = (protos ?? []).filter((p) => p.stage === "aprovado").length;
  const opsConcluidas = (ops ?? []).filter((o) => o.status === "concluida").length;

  const firstOp = (ops ?? [])
    .map((o) => new Date(o.created_at).getTime())
    .sort((a, b) => a - b)[0];
  const ttm = firstOp ? Math.round((firstOp - new Date(collection.created_at).getTime()) / 86_400_000) : null;

  return {
    products: products?.length ?? 0,
    avgCost: avg(costs),
    avgPrice: avg(prices),
    avgMarginPct: avg(margins),
    prototypes: protos?.length ?? 0,
    prototypesApproved: approved,
    approvalPct: protos?.length ? (approved / protos.length) * 100 : 0,
    ops: ops?.length ?? 0,
    opsConcluidas,
    conclusionPct: ops?.length ? (opsConcluidas / ops.length) * 100 : 0,
    timeToMarketDays: ttm,
  };
}

function fmtMoney(n: number) {
  return n > 0 ? `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
}
function fmtPct(n: number) { return n > 0 ? `${n.toFixed(1)}%` : "—"; }

export function CollectionCompareDialog({ collections }: { collections: Collection[] }) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...collections].sort((a, b) => a.name.localeCompare(b.name)), [collections]);
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");

  const a = sorted.find((c) => c.id === aId) ?? null;
  const b = sorted.find((c) => c.id === bId) ?? null;

  const qa = useQuery({ queryKey: ["collection-compare", aId], queryFn: () => loadStats(a!), enabled: !!a });
  const qb = useQuery({ queryKey: ["collection-compare", bId], queryFn: () => loadStats(b!), enabled: !!b });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2" disabled={collections.length < 2}>
        <GitCompare className="size-4" /> Comparar coleções
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GitCompare className="size-4 text-primary" /> Comparativo de coleções</DialogTitle>
            <DialogDescription>Margem média, taxa de aprovação de protótipos e time-to-market lado a lado.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Select value={aId} onValueChange={setAId}>
              <SelectTrigger><SelectValue placeholder="Coleção A" /></SelectTrigger>
              <SelectContent>
                {sorted.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.season ? ` · ${c.season} ${c.year ?? ""}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <ArrowRight className="size-4 text-muted-foreground" />
            <Select value={bId} onValueChange={setBId}>
              <SelectTrigger><SelectValue placeholder="Coleção B" /></SelectTrigger>
              <SelectContent>
                {sorted.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.season ? ` · ${c.season} ${c.year ?? ""}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(a && b) ? (
            <ComparisonGrid a={a} b={b} sa={qa.data} sb={qb.data} loading={qa.isLoading || qb.isLoading} />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">Selecione duas coleções para comparar.</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ComparisonGrid({ a, b, sa, sb, loading }: { a: Collection; b: Collection; sa?: Stats; sb?: Stats; loading: boolean }) {
  if (loading || !sa || !sb) return <div className="text-sm text-muted-foreground text-center py-8">Calculando KPIs…</div>;

  const rows: Array<{ label: string; va: string; vb: string; betterA?: boolean; betterB?: boolean }> = [
    { label: "Produtos", va: String(sa.products), vb: String(sb.products), betterA: sa.products > sb.products, betterB: sb.products > sa.products },
    { label: "Custo médio", va: fmtMoney(sa.avgCost), vb: fmtMoney(sb.avgCost), betterA: sa.avgCost > 0 && sa.avgCost < sb.avgCost, betterB: sb.avgCost > 0 && sb.avgCost < sa.avgCost },
    { label: "Preço médio", va: fmtMoney(sa.avgPrice), vb: fmtMoney(sb.avgPrice), betterA: sa.avgPrice > sb.avgPrice, betterB: sb.avgPrice > sa.avgPrice },
    { label: "Margem média", va: fmtPct(sa.avgMarginPct), vb: fmtPct(sb.avgMarginPct), betterA: sa.avgMarginPct > sb.avgMarginPct, betterB: sb.avgMarginPct > sa.avgMarginPct },
    { label: "Protótipos (aprovados/total)", va: `${sa.prototypesApproved}/${sa.prototypes}`, vb: `${sb.prototypesApproved}/${sb.prototypes}` },
    { label: "Taxa de aprovação", va: fmtPct(sa.approvalPct), vb: fmtPct(sb.approvalPct), betterA: sa.approvalPct > sb.approvalPct, betterB: sb.approvalPct > sa.approvalPct },
    { label: "OPs (concluídas/total)", va: `${sa.opsConcluidas}/${sa.ops}`, vb: `${sb.opsConcluidas}/${sb.ops}` },
    { label: "Taxa de conclusão", va: fmtPct(sa.conclusionPct), vb: fmtPct(sb.conclusionPct), betterA: sa.conclusionPct > sb.conclusionPct, betterB: sb.conclusionPct > sa.conclusionPct },
    {
      label: "Time-to-market (1ª OP)",
      va: sa.timeToMarketDays !== null ? `${sa.timeToMarketDays}d` : "—",
      vb: sb.timeToMarketDays !== null ? `${sb.timeToMarketDays}d` : "—",
      betterA: sa.timeToMarketDays !== null && sb.timeToMarketDays !== null && sa.timeToMarketDays < sb.timeToMarketDays,
      betterB: sa.timeToMarketDays !== null && sb.timeToMarketDays !== null && sb.timeToMarketDays < sa.timeToMarketDays,
    },
  ];

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-3 bg-muted/40 text-xs uppercase text-muted-foreground">
        <div className="px-3 py-2">Indicador</div>
        <div className="px-3 py-2 truncate">{a.name}</div>
        <div className="px-3 py-2 truncate">{b.name}</div>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-3 border-t border-border text-sm">
          <div className="px-3 py-2 text-muted-foreground">{r.label}</div>
          <div className={`px-3 py-2 tabular-nums ${r.betterA ? "text-emerald-500 font-medium" : ""}`}>{r.va}</div>
          <div className={`px-3 py-2 tabular-nums ${r.betterB ? "text-emerald-500 font-medium" : ""}`}>{r.vb}</div>
        </div>
      ))}
    </div>
  );
}
