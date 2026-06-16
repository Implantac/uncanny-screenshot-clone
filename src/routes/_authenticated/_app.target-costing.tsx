import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/target-costing")({
  head: () => ({ meta: [{ title: "Target Costing · USE MODA PLM" }, { name: "description", content: "Meta de custo e margem por produto vs custo real." }] }),
  component: Page,
});

type Row = { id: string; sku: string; name: string; cost_price: number | null; target_cost: number; target_margin_pct: number; target_retail_price: number; target_id: string | null };

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Record<string, { target_cost: number; target_margin_pct: number; target_retail_price: number }>>({});

  const rows = useQuery({
    queryKey: ["target-costing"],
    queryFn: async () => {
      const [{ data: products }, { data: targets }] = await Promise.all([
        supabase.from("products").select("id, sku, name, cost_price").order("name"),
        (supabase as any).from("product_target_costs").select("*"),
      ]);
      return (products ?? []).map((p: any) => {
        const t = (targets ?? []).find((x: any) => x.product_id === p.id);
        return {
          id: p.id, sku: p.sku, name: p.name, cost_price: p.cost_price,
          target_cost: t?.target_cost ?? 0,
          target_margin_pct: t?.target_margin_pct ?? 0,
          target_retail_price: t?.target_retail_price ?? 0,
          target_id: t?.id ?? null,
        } as Row;
      });
    },
  });

  const save = useMutation({
    mutationFn: async (r: Row) => {
      const e = edit[r.id] ?? { target_cost: r.target_cost, target_margin_pct: r.target_margin_pct, target_retail_price: r.target_retail_price };
      const { error } = await (supabase as any).from("product_target_costs").upsert(
        { owner_id: user!.id, product_id: r.id, ...e },
        { onConflict: "owner_id,product_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meta salva"); qc.invalidateQueries({ queryKey: ["target-costing"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Target Costing</h1>
          <p className="text-sm text-muted-foreground">Meta de custo e margem por produto, comparada ao custo real da ficha técnica.</p>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left p-3">Produto</th>
              <th className="text-right p-3">Custo real</th>
              <th className="text-right p-3">Custo alvo</th>
              <th className="text-right p-3">Margem alvo %</th>
              <th className="text-right p-3">Preço alvo</th>
              <th className="text-right p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.data?.map((r) => {
              const e = edit[r.id] ?? { target_cost: r.target_cost, target_margin_pct: r.target_margin_pct, target_retail_price: r.target_retail_price };
              const over = r.cost_price != null && e.target_cost > 0 && r.cost_price > e.target_cost;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.sku}</div>
                  </td>
                  <td className="text-right p-3">R$ {Number(r.cost_price ?? 0).toFixed(2)}</td>
                  <td className="text-right p-3"><Input className="w-24 text-right ml-auto" type="number" value={e.target_cost} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, target_cost: Number(ev.target.value) } })} /></td>
                  <td className="text-right p-3"><Input className="w-20 text-right ml-auto" type="number" value={e.target_margin_pct} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, target_margin_pct: Number(ev.target.value) } })} /></td>
                  <td className="text-right p-3"><Input className="w-24 text-right ml-auto" type="number" value={e.target_retail_price} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, target_retail_price: Number(ev.target.value) } })} /></td>
                  <td className="text-right p-3">
                    {e.target_cost === 0 ? <Badge variant="outline">sem meta</Badge> :
                      over ? <Badge variant="destructive"><TrendingUp className="h-3 w-3 mr-1" />acima</Badge> :
                      <Badge className="bg-green-600"><TrendingDown className="h-3 w-3 mr-1" />ok</Badge>}
                  </td>
                  <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => save.mutate(r)}>Salvar</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
