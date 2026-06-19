import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Layers3, Scissors, Ruler, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = { sheetId: string; ownerId: string; canEdit: boolean };

type Material = {
  id: string;
  name: string;
  unit: string;
  consumption: number;
  loss_pct: number;
  unit_cost: number;
  total_cost: number;
  position: number;
};

type Operation = {
  id: string;
  name: string;
  machine: string | null;
  sam: number;
  rate_per_min: number;
  total_cost: number;
  position: number;
};

type Measurement = {
  id: string;
  point: string;
  tolerance_plus: number;
  tolerance_minus: number;
  sizes: Record<string, number>;
  position: number;
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ------------------------------- Materials -------------------------------- */
export function MaterialsPanel({ sheetId, ownerId, canEdit }: Props) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["ts-materials", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_materials")
        .select("*")
        .eq("tech_sheet_id", sheetId)
        .order("position");
      if (error) throw error;
      return data as Material[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tech_sheet_materials").insert({
        owner_id: ownerId,
        tech_sheet_id: sheetId,
        name: "Novo material",
        unit: "m",
        consumption: 0,
        loss_pct: 0,
        unit_cost: 0,
        position: data.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-materials", sheetId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Material> }) => {
      const { error } = await supabase.from("tech_sheet_materials").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-materials", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_sheet_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-materials", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
  });

  const total = data.reduce((s, m) => s + Number(m.total_cost || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Layers3 className="size-4 text-primary" /> BOM · Materiais
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => add.mutate()}>
            <Plus className="size-3.5" /> Material
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum material no BOM ainda.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="w-20">Un</TableHead>
                <TableHead className="w-24 text-right">Consumo</TableHead>
                <TableHead className="w-20 text-right">Perda %</TableHead>
                <TableHead className="w-28 text-right">Custo un.</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                {canEdit && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <EditableText
                      value={m.name}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { name: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableText
                      value={m.unit}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { unit: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={m.consumption}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { consumption: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={m.loss_pct}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { loss_pct: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={m.unit_cost}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { unit_cost: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(Number(m.total_cost || 0))}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive"
                        onClick={() => del.mutate(m.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={5} className="text-right">
                  Subtotal materiais
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(total)}</TableCell>
                {canEdit && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Operations ------------------------------- */
export function OperationsPanel({ sheetId, ownerId, canEdit }: Props) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["ts-ops", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_operations")
        .select("*")
        .eq("tech_sheet_id", sheetId)
        .order("position");
      if (error) throw error;
      return data as Operation[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tech_sheet_operations").insert({
        owner_id: ownerId,
        tech_sheet_id: sheetId,
        name: "Nova operação",
        machine: "",
        sam: 0,
        rate_per_min: 0,
        position: data.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-ops", sheetId] }),
  });

  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Operation> }) => {
      const { error } = await supabase.from("tech_sheet_operations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-ops", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_sheet_operations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-ops", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
  });

  const totalSam = data.reduce((s, o) => s + Number(o.sam || 0), 0);
  const totalCost = data.reduce((s, o) => s + Number(o.total_cost || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Scissors className="size-4 text-primary" /> Operações · SAM
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => add.mutate()}>
            <Plus className="size-3.5" /> Operação
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma operação cadastrada.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead className="w-32">Máquina</TableHead>
                <TableHead className="w-24 text-right">SAM (min)</TableHead>
                <TableHead className="w-28 text-right">R$ / min</TableHead>
                <TableHead className="w-28 text-right">Custo</TableHead>
                {canEdit && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <EditableText
                      value={o.name}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: o.id, patch: { name: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableText
                      value={o.machine ?? ""}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: o.id, patch: { machine: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={o.sam}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: o.id, patch: { sam: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={o.rate_per_min}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: o.id, patch: { rate_per_min: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(Number(o.total_cost || 0))}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive"
                        onClick={() => del.mutate(o.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={2} className="text-right">
                  Totais
                </TableCell>
                <TableCell className="text-right tabular-nums">{totalSam.toFixed(2)}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{fmt(totalCost)}</TableCell>
                {canEdit && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Measurements ------------------------------ */
export function MeasurementsPanel({ sheetId, ownerId, canEdit }: Props) {
  const qc = useQueryClient();
  const [sizesInput, setSizesInput] = useState("P,M,G,GG");

  const { data = [], isLoading } = useQuery({
    queryKey: ["ts-meas", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_measurements")
        .select("*")
        .eq("tech_sheet_id", sheetId)
        .order("position");
      if (error) throw error;
      return data as Measurement[];
    },
  });

  const sizes = Array.from(
    new Set([
      ...sizesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ...data.flatMap((m) => Object.keys(m.sizes || {})),
    ]),
  );

  const add = useMutation({
    mutationFn: async () => {
      const empty: Record<string, number> = {};
      sizes.forEach((s) => (empty[s] = 0));
      const { error } = await supabase.from("tech_sheet_measurements").insert({
        owner_id: ownerId,
        tech_sheet_id: sheetId,
        point: "Novo ponto",
        tolerance_plus: 1,
        tolerance_minus: 1,
        sizes: empty,
        position: data.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-meas", sheetId] }),
  });

  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Measurement> }) => {
      const { error } = await supabase.from("tech_sheet_measurements").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-meas", sheetId] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_sheet_measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-meas", sheetId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Ruler className="size-4 text-primary" /> POM · Medidas (cm)
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Grade</Label>
          <Input
            value={sizesInput}
            onChange={(e) => setSizesInput(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          {canEdit && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => add.mutate()}>
              <Plus className="size-3.5" /> Ponto
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum ponto de medida.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ponto</TableHead>
                <TableHead className="w-16 text-right">Tol +</TableHead>
                <TableHead className="w-16 text-right">Tol −</TableHead>
                {sizes.map((s) => (
                  <TableHead key={s} className="w-20 text-right">
                    {s}
                  </TableHead>
                ))}
                {canEdit && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <EditableText
                      value={m.point}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { point: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={m.tolerance_plus}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { tolerance_plus: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableNum
                      value={m.tolerance_minus}
                      disabled={!canEdit}
                      onSave={(v) => upd.mutate({ id: m.id, patch: { tolerance_minus: v } })}
                    />
                  </TableCell>
                  {sizes.map((s) => (
                    <TableCell key={s} className="text-right">
                      <EditableNum
                        value={Number(m.sizes?.[s] ?? 0)}
                        disabled={!canEdit}
                        onSave={(v) =>
                          upd.mutate({ id: m.id, patch: { sizes: { ...(m.sizes || {}), [s]: v } } })
                        }
                      />
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive"
                        onClick={() => del.mutate(m.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Costs --------------------------------- */
export function CostsPanel({ sheetId, ownerId: _ownerId, canEdit }: Props) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ts-costs", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheets")
        .select("materials_cost, labor_cost, overhead_pct, cost_price")
        .eq("id", sheetId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const upd = useMutation({
    mutationFn: async (overhead_pct: number) => {
      const { error } = await supabase
        .from("tech_sheets")
        .update({ overhead_pct })
        .eq("id", sheetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-costs", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
  });

  if (!data) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  const mat = Number(data.materials_cost || 0);
  const lab = Number(data.labor_cost || 0);
  const oh = Number(data.overhead_pct || 0);
  const total = Number(data.cost_price || 0);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Wallet className="size-4 text-primary" /> Custo total da ficha
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CostCard label="Materiais" value={fmt(mat)} />
        <CostCard label="Mão de obra" value={fmt(lab)} />
        <div className="rounded-xl border border-border bg-background/30 p-3">
          <div className="text-xs text-muted-foreground">Overhead (%)</div>
          <EditableNum
            value={oh}
            disabled={!canEdit}
            onSave={(v) => upd.mutate(v)}
            className="text-lg font-semibold mt-1"
          />
        </div>
        <CostCard label="Custo final" value={fmt(total)} highlight />
      </div>
      <p className="text-xs text-muted-foreground">
        Custo final = (materiais + mão de obra) × (1 + overhead%). Atualiza automaticamente quando
        você edita BOM ou operações.
      </p>
    </div>
  );
}

function CostCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${highlight ? "border-primary/40 bg-primary/10" : "border-border bg-background/30"}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

/* --------------------------------- Inputs --------------------------------- */
function EditableText({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  return (
    <Input
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-border"
    />
  );
}

function EditableNum({
  value,
  onSave,
  disabled,
  className,
}: {
  value: number;
  onSave: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [v, setV] = useState(String(value));
  return (
    <Input
      type="number"
      step="0.01"
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Number(v);
        if (!Number.isNaN(n) && n !== value) onSave(n);
      }}
      className={`h-8 text-sm text-right bg-transparent border-transparent hover:border-border focus:border-border tabular-nums ${className ?? ""}`}
    />
  );
}
