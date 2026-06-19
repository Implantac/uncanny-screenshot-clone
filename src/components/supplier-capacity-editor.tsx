import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { upsertSupplierCapacity } from "@/lib/pcp-intelligence.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Factory } from "lucide-react";

type Row = {
  supplier_id: string;
  name: string;
  pieces_per_day: number;
  working_days_per_week: number;
};

async function loadRows() {
  const [{ data: sups }, { data: caps }] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("supplier_capacity").select("supplier_id, pieces_per_day, working_days_per_week"),
  ]);
  const map = new Map((caps ?? []).map((c) => [c.supplier_id, c]));
  return (sups ?? []).map((s): Row => {
    const c = map.get(s.id);
    return {
      supplier_id: s.id,
      name: s.name,
      pieces_per_day: c?.pieces_per_day ?? 0,
      working_days_per_week: c?.working_days_per_week ?? 5,
    };
  });
}

export function SupplierCapacityEditor() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertSupplierCapacity);
  const { data, isLoading } = useQuery({ queryKey: ["supplier-capacity-rows"], queryFn: loadRows });
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (r: Row) =>
      upsertFn({
        data: {
          supplier_id: r.supplier_id,
          pieces_per_day: r.pieces_per_day,
          working_days_per_week: r.working_days_per_week,
        },
      }),
    onSuccess: () => {
      toast.success("Capacidade salva");
      qc.invalidateQueries({ queryKey: ["pcp-intelligence"] });
      qc.invalidateQueries({ queryKey: ["supplier-capacity-rows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border font-medium flex items-center gap-2 text-sm">
        <Factory className="size-4 text-primary" /> Capacidade dos fornecedores
        <span className="ml-auto text-xs text-muted-foreground font-normal">
          peças por dia útil
        </span>
      </div>
      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">
          Cadastre fornecedores primeiro.
        </div>
      ) : (
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {rows.map((r, i) => (
            <div key={r.supplier_id} className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5 text-sm truncate">{r.name}</div>
              <Input
                type="number"
                min={0}
                className="col-span-3 h-8 text-sm"
                value={r.pieces_per_day}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  setRows((arr) => arr.map((x, idx) => (idx === i ? { ...x, pieces_per_day: v } : x)));
                }}
              />
              <Input
                type="number"
                min={1}
                max={7}
                className="col-span-2 h-8 text-sm"
                value={r.working_days_per_week}
                onChange={(e) => {
                  const v = Math.min(7, Math.max(1, Number(e.target.value) || 5));
                  setRows((arr) =>
                    arr.map((x, idx) => (idx === i ? { ...x, working_days_per_week: v } : x)),
                  );
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="col-span-2 h-8"
                disabled={save.isPending}
                onClick={() => save.mutate(r)}
              >
                <Save className="size-3" />
                Salvar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
