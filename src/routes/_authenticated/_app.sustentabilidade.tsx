import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/sustentabilidade")({
  head: () => ({
    meta: [
      { title: "Sustainability Scoring · USE MODA PLM" },
      {
        name: "description",
        content: "Pegada CO₂, % materiais sustentáveis, certificações por produto.",
      },
    ],
  }),
  component: Page,
});

type Row = {
  id: string;
  sku: string;
  name: string;
  s_id: string | null;
  co2_kg: number;
  water_liters: number;
  recycled_pct: number;
  organic_pct: number;
  score_overall: number;
  certifications: string[];
};

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Record<string, Partial<Row>>>({});

  const rows = useQuery({
    queryKey: ["sustainability"],
    queryFn: async () => {
      const [{ data: products }, { data: scores }] = await Promise.all([
        supabase.from("products").select("id, sku, name").order("name"),
        (supabase as any).from("product_sustainability").select("*"),
      ]);
      return (products ?? []).map((p: any) => {
        const s = (scores ?? []).find((x: any) => x.product_id === p.id);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          s_id: s?.id ?? null,
          co2_kg: s?.co2_kg ?? 0,
          water_liters: s?.water_liters ?? 0,
          recycled_pct: s?.recycled_pct ?? 0,
          organic_pct: s?.organic_pct ?? 0,
          score_overall: s?.score_overall ?? 0,
          certifications: s?.certifications ?? [],
        } as Row;
      });
    },
  });

  const save = useMutation({
    mutationFn: async (r: Row) => {
      const e = { ...r, ...edit[r.id] };
      const score = Math.min(
        100,
        Math.round(
          (Number(e.recycled_pct || 0) + Number(e.organic_pct || 0)) / 2 +
            e.certifications.length * 5,
        ),
      );
      const { error } = await (supabase as any).from("product_sustainability").upsert(
        {
          owner_id: user!.id,
          product_id: r.id,
          co2_kg: e.co2_kg,
          water_liters: e.water_liters,
          recycled_pct: e.recycled_pct,
          organic_pct: e.organic_pct,
          certifications: e.certifications,
          score_overall: score,
        },
        { onConflict: "owner_id,product_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Score salvo");
      qc.invalidateQueries({ queryKey: ["sustainability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Leaf className="h-6 w-6 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold">Sustainability Scoring</h1>
          <p className="text-sm text-muted-foreground">
            Score por produto: pegada CO₂, água, % reciclado/orgânico e certificações.
          </p>
        </div>
      </div>
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left p-3">Produto</th>
              <th className="text-right p-3">CO₂ kg</th>
              <th className="text-right p-3">Água L</th>
              <th className="text-right p-3">% reciclado</th>
              <th className="text-right p-3">% orgânico</th>
              <th className="text-left p-3">Certificações (vírgula)</th>
              <th className="text-right p-3">Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.data?.map((r) => {
              const e = { ...r, ...edit[r.id] };
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.sku}</div>
                  </td>
                  <td className="text-right p-3">
                    <Input
                      className="w-20 text-right ml-auto"
                      type="number"
                      value={e.co2_kg}
                      onChange={(ev) =>
                        setEdit({ ...edit, [r.id]: { ...e, co2_kg: Number(ev.target.value) } })
                      }
                    />
                  </td>
                  <td className="text-right p-3">
                    <Input
                      className="w-20 text-right ml-auto"
                      type="number"
                      value={e.water_liters}
                      onChange={(ev) =>
                        setEdit({
                          ...edit,
                          [r.id]: { ...e, water_liters: Number(ev.target.value) },
                        })
                      }
                    />
                  </td>
                  <td className="text-right p-3">
                    <Input
                      className="w-20 text-right ml-auto"
                      type="number"
                      value={e.recycled_pct}
                      onChange={(ev) =>
                        setEdit({
                          ...edit,
                          [r.id]: { ...e, recycled_pct: Number(ev.target.value) },
                        })
                      }
                    />
                  </td>
                  <td className="text-right p-3">
                    <Input
                      className="w-20 text-right ml-auto"
                      type="number"
                      value={e.organic_pct}
                      onChange={(ev) =>
                        setEdit({ ...edit, [r.id]: { ...e, organic_pct: Number(ev.target.value) } })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      value={(e.certifications || []).join(", ")}
                      onChange={(ev) =>
                        setEdit({
                          ...edit,
                          [r.id]: {
                            ...e,
                            certifications: ev.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </td>
                  <td className="text-right p-3">
                    <Badge
                      className={
                        e.score_overall >= 70
                          ? "bg-green-600"
                          : e.score_overall >= 40
                            ? "bg-yellow-600"
                            : "bg-red-600"
                      }
                    >
                      {e.score_overall}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => save.mutate(r)}>
                      Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
