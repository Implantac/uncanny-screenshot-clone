import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Award } from "lucide-react";

type Supplier = { id: string; name: string; active: boolean | null };
type PO = { id: string; supplier_id: string | null; status: string; expected_date: string | null; created_at: string; updated_at: string };
type POItem = { purchase_order_id: string; unit_price: number | null; quantity: number | null };
type Compliance = { supplier_id: string; expires_at: string | null };

type Score = {
  supplier: Supplier;
  composite: number;
  ordersCount: number;
  avgPrice: number | null;
  avgLeadDays: number | null;
  onTimePct: number | null;
  validCerts: number;
};

function pctFmt(n: number | null) { return n === null ? "—" : `${Math.round(n)}%`; }
function moneyFmt(n: number | null) { return n === null ? "—" : `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`; }

export function SupplierRecommender({ rfqTitle }: { rfqTitle?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-recommender"],
    queryFn: async () => {
      const [s, p, i, c] = await Promise.all([
        supabase.from("suppliers").select("id, name, active").limit(500),
        supabase.from("purchase_orders").select("id, supplier_id, status, expected_date, created_at, updated_at").limit(2000),
        supabase.from("purchase_order_items").select("purchase_order_id, unit_price, quantity").limit(5000),
        supabase.from("supplier_compliance").select("supplier_id, expires_at").limit(2000),
      ]);
      return {
        suppliers: (s.data ?? []) as Supplier[],
        pos: (p.data ?? []) as PO[],
        items: (i.data ?? []) as POItem[],
        certs: (c.data ?? []) as Compliance[],
      };
    },
  });

  const ranked: Score[] = useMemo(() => {
    if (!data) return [];
    const itemsByPo = new Map<string, POItem[]>();
    data.items.forEach((it) => {
      const arr = itemsByPo.get(it.purchase_order_id) ?? [];
      arr.push(it);
      itemsByPo.set(it.purchase_order_id, arr);
    });
    const now = Date.now();
    const certsBySupplier = new Map<string, number>();
    data.certs.forEach((c) => {
      const ok = !c.expires_at || new Date(c.expires_at).getTime() > now;
      if (ok) certsBySupplier.set(c.supplier_id, (certsBySupplier.get(c.supplier_id) ?? 0) + 1);
    });

    const rows: Score[] = data.suppliers.filter((s) => s.active !== false).map((s) => {
      const supplierPOs = data.pos.filter((p) => p.supplier_id === s.id);
      const receivedPOs = supplierPOs.filter((p) => p.status === "recebido");

      const prices: number[] = [];
      supplierPOs.forEach((p) => (itemsByPo.get(p.id) ?? []).forEach((it) => {
        const v = Number(it.unit_price ?? 0);
        if (v > 0) prices.push(v);
      }));
      const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

      const leadDays: number[] = supplierPOs
        .filter((p) => p.expected_date)
        .map((p) => Math.round((new Date(p.expected_date!).getTime() - new Date(p.created_at).getTime()) / 86_400_000))
        .filter((n) => n > 0 && n < 365);
      const avgLeadDays = leadDays.length ? leadDays.reduce((a, b) => a + b, 0) / leadDays.length : null;

      const onTimeArr = receivedPOs
        .filter((p) => p.expected_date)
        .map((p) => new Date(p.updated_at).getTime() <= new Date(p.expected_date!).getTime() + 86_400_000);
      const onTimePct = onTimeArr.length ? (onTimeArr.filter(Boolean).length / onTimeArr.length) * 100 : null;

      const validCerts = certsBySupplier.get(s.id) ?? 0;

      // composite (0-100): on-time 35% + price 25% + lead 20% + certs 10% + experience 10%
      const onTimeScore = onTimePct ?? 50;
      const priceScore = avgPrice === null ? 50 : 100; // relative below
      const leadScore = avgLeadDays === null ? 50 : Math.max(0, 100 - avgLeadDays * 1.5);
      const certsScore = Math.min(100, validCerts * 25);
      const expScore = Math.min(100, supplierPOs.length * 10);

      const composite = onTimeScore * 0.35 + priceScore * 0.25 + leadScore * 0.20 + certsScore * 0.10 + expScore * 0.10;
      return { supplier: s, composite, ordersCount: supplierPOs.length, avgPrice, avgLeadDays, onTimePct, validCerts };
    });

    // Normalize priceScore relative to dataset
    const priced = rows.filter((r) => r.avgPrice !== null);
    if (priced.length >= 2) {
      const min = Math.min(...priced.map((r) => r.avgPrice!));
      const max = Math.max(...priced.map((r) => r.avgPrice!));
      const range = Math.max(0.0001, max - min);
      rows.forEach((r) => {
        if (r.avgPrice === null) return;
        const priceScore = 100 - ((r.avgPrice - min) / range) * 100; // cheaper = higher
        const onTimeScore = r.onTimePct ?? 50;
        const leadScore = r.avgLeadDays === null ? 50 : Math.max(0, 100 - r.avgLeadDays * 1.5);
        const certsScore = Math.min(100, r.validCerts * 25);
        const expScore = Math.min(100, r.ordersCount * 10);
        r.composite = onTimeScore * 0.35 + priceScore * 0.25 + leadScore * 0.20 + certsScore * 0.10 + expScore * 0.10;
      });
    }

    return rows.sort((a, b) => b.composite - a.composite).slice(0, 5);
  }, [data]);

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-semibold text-sm">Sourcing inteligente · fornecedores recomendados</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Ranking por histórico (preço, prazo, pontualidade, certificações).{rfqTitle ? ` Para: "${rfqTitle}"` : ""}
      </p>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-3">Calculando…</div>
      ) : ranked.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3">Sem histórico de compras suficiente para recomendar.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-2">Fornecedor</th>
                <th className="text-right p-2">Score</th>
                <th className="text-right p-2">Pontualidade</th>
                <th className="text-right p-2">Lead médio</th>
                <th className="text-right p-2">Preço médio</th>
                <th className="text-right p-2">Certs</th>
                <th className="text-right p-2">POs</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => {
                const tone = r.composite >= 75 ? "text-emerald-500" : r.composite >= 55 ? "text-amber-500" : "text-muted-foreground";
                return (
                  <tr key={r.supplier.id} className="border-t border-border">
                    <td className="p-2 font-medium flex items-center gap-1.5">
                      {i === 0 && <Award className="size-3.5 text-primary" />}
                      {r.supplier.name}
                    </td>
                    <td className={`p-2 text-right tabular-nums font-semibold ${tone}`}>{Math.round(r.composite)}</td>
                    <td className="p-2 text-right tabular-nums">{pctFmt(r.onTimePct)}</td>
                    <td className="p-2 text-right tabular-nums">{r.avgLeadDays === null ? "—" : `${Math.round(r.avgLeadDays)}d`}</td>
                    <td className="p-2 text-right tabular-nums">{moneyFmt(r.avgPrice)}</td>
                    <td className="p-2 text-right tabular-nums">{r.validCerts}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{r.ordersCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
