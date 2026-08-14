import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Layers3,
  Scissors,
  Ruler,
  Wallet,
  ArrowUp,
  ArrowDown,
  Link2,
  X,
  Search,
  Library,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MaterialPickerDialog, type LibraryMaterial } from "@/components/material-picker-dialog";
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
  type: string | null;
  code: string | null;
  description: string | null;
  supplier: string | null;
  color: string | null;
  unit: string;
  consumption: number;
  consumption_by_size: Record<string, number> | null;
  loss_pct: number;
  unit_cost: number;
  total_cost: number;
  position: number;
  inventory_item_id: string | null;
};

const MATERIAL_TYPES = [
  "Tecido",
  "Malha",
  "Forro",
  "Botão",
  "Zíper",
  "Linha",
  "Elástico",
  "Etiqueta",
  "Tag",
  "Embalagem",
  "Renda",
  "Entretela",
  "Aviamento",
  "Insumo de lavanderia",
  "Serviço de estamparia",
  "Serviço de bordado",
];

type Operation = {
  id: string;
  name: string;
  machine: string | null;
  responsible_role: string | null;
  sam: number;
  rate_per_min: number;
  total_cost: number;
  position: number;
};

const RESPONSIBLE_ROLES = [
  "Corte",
  "Costura",
  "Acabamento",
  "Bordado/Silk",
  "Qualidade",
  "Modelagem",
  "Pilotagem",
  "Terceiro",
  "Expedição",
];

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("todos");
  const { data = [], isLoading } = useQuery({
    queryKey: ["ts-materials", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_materials")
        .select("*")
        .eq("tech_sheet_id", sheetId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as Material[];
    },
  });
  const filtered = useMemo(
    () => (typeFilter === "todos" ? data : data.filter((m) => (m.type ?? "Outros") === typeFilter)),
    [data, typeFilter],
  );

  // Lookup de foto/cor a partir da Biblioteca Global (best-effort por nome)
  const { data: library = [] } = useQuery({
    queryKey: ["ts-materials-lib", ownerId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("material_library")
        .select("name, image_url, color_hex")
        .eq("owner_id", ownerId)
        .eq("active", true);
      return (data ?? []) as { name: string; image_url: string | null; color_hex: string | null }[];
    },
    staleTime: 60_000,
  });
  const libMap = useMemo(() => {
    const m = new Map<string, { image_url: string | null; color_hex: string | null }>();
    for (const l of library) m.set(l.name.trim().toLowerCase(), l);
    return m;
  }, [library]);

  const addFromLibrary = useMutation({
    mutationFn: async (m: LibraryMaterial) => {
      let inventoryId: string | null = null;
      const { data: invMatch } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("sku", m.code)
        .maybeSingle();
      if (invMatch?.id) inventoryId = invMatch.id;

      const { error } = await supabase.from("tech_sheet_materials").insert({
        owner_id: ownerId,
        tech_sheet_id: sheetId,
        material_id: m.id,
        name: m.name,
        type: MATERIAL_TYPES.includes(m.kind) ? m.kind : ((m.kind as string) ?? null),
        code: m.code ?? null,
        description: null,
        supplier: null,
        color: null,
        unit: m.unit ?? "un",
        consumption: 0,
        loss_pct: 0,
        unit_cost: Number(m.reference_cost ?? 0),
        position: data.length,
        inventory_item_id: inventoryId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material adicionado ao BOM");
      qc.invalidateQueries({ queryKey: ["ts-materials", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBlank = useMutation({
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
      const { error } = await supabase
        .from("tech_sheet_materials")
        .update(patch as Record<string, never>)
        .eq("id", id);
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
      <MaterialPickerDialog
        ownerId={ownerId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(m) => addFromLibrary.mutate(m)}
        onCreateBlank={() => addBlank.mutate()}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="size-4 text-primary" /> BOM · Materiais
          {data.length > 0 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-7 rounded-md border border-border bg-background px-1.5 text-[11px] text-muted-foreground"
              title="Filtrar por tipo de material"
            >
              <option value="todos">Todos os tipos</option>
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => exportBomPdf(data, libMap, total)}
            >
              <FileDown className="size-3.5" /> Exportar PDF
            </Button>
          )}
          {canEdit && (
            <Button size="sm" className="gap-1" onClick={() => setPickerOpen(true)}>
              <Library className="size-3.5" /> Adicionar da Biblioteca
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum material no BOM ainda.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Foto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead className="w-28">Fornecedor</TableHead>
                  <TableHead className="w-20">Cor</TableHead>
                  <TableHead className="w-40">Almox.</TableHead>
                  <TableHead className="w-20">Un</TableHead>
                  <TableHead className="w-24 text-right">Consumo</TableHead>
                  <TableHead className="w-20 text-right">Perda %</TableHead>
                  <TableHead className="w-28 text-right">Custo un.</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const lib = libMap.get(m.name.trim().toLowerCase());
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div
                          className="size-10 rounded-md border border-border/60 overflow-hidden shrink-0"
                          style={{ background: lib?.color_hex || "hsl(var(--muted))" }}
                        >
                          {lib?.image_url && (
                            <img
                              src={lib.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <select
                            value={m.type ?? ""}
                            onChange={(e) =>
                              upd.mutate({ id: m.id, patch: { type: e.target.value || null } })
                            }
                            className="w-full h-7 rounded-md border border-transparent bg-transparent px-1.5 text-xs hover:border-border focus:border-border"
                          >
                            <option value="">—</option>
                            {MATERIAL_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">{m.type ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <EditableText
                          value={m.name}
                          disabled={!canEdit}
                          onSave={(v) => upd.mutate({ id: m.id, patch: { name: v } })}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableText
                          value={m.code ?? ""}
                          disabled={!canEdit}
                          onSave={(v) => upd.mutate({ id: m.id, patch: { code: v || null } })}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableText
                          value={m.supplier ?? ""}
                          disabled={!canEdit}
                          onSave={(v) => upd.mutate({ id: m.id, patch: { supplier: v || null } })}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableText
                          value={m.color ?? ""}
                          disabled={!canEdit}
                          onSave={(v) => upd.mutate({ id: m.id, patch: { color: v || null } })}
                        />
                      </TableCell>
                      <TableCell>
                        <InventoryLinkCell
                          ownerId={ownerId}
                          value={m.inventory_item_id}
                          disabled={!canEdit}
                          onChange={(id) =>
                            upd.mutate({ id: m.id, patch: { inventory_item_id: id } })
                          }
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
                        <div className="flex items-center justify-end gap-1">
                          <EditableNum
                            value={m.consumption}
                            disabled={!canEdit}
                            onSave={(v) => upd.mutate({ id: m.id, patch: { consumption: v } })}
                          />
                          <SizeConsumptionPopover
                            value={m.consumption_by_size}
                            disabled={!canEdit}
                            onSave={(v: Record<string, number> | null) =>
                              upd.mutate({
                                id: m.id,
                                patch: { consumption_by_size: v } as Partial<Material>,
                              })
                            }
                          />
                        </div>
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
                      <TableCell className="text-right tabular-nums font-medium">
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-primary/80 font-medium">
                Custo Total de Matéria-Prima
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {data.length} {data.length === 1 ? "item" : "itens"} no BOM · atualiza
                automaticamente com consumo, perda e custo unitário.
              </div>
            </div>
            <div className="text-3xl font-bold tabular-nums text-primary">{fmt(total)}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------- BOM PDF export helper --------------------------- */
function exportBomPdf(
  data: Material[],
  libMap: Map<string, { image_url: string | null; color_hex: string | null }>,
  total: number,
) {
  const rows = data
    .map((m) => {
      const lib = libMap.get(m.name.trim().toLowerCase());
      const img = lib?.image_url
        ? `<img src="${lib.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #ddd" />`
        : `<div style="width:40px;height:40px;border-radius:4px;background:${lib?.color_hex || "#eee"};border:1px solid #ddd"></div>`;
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${img}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(m.type || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-weight:500">${escapeHtml(m.name)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px">${escapeHtml(m.code || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(m.supplier || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(m.color || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(m.unit || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Number(m.consumption || 0).toFixed(3)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Number(m.loss_pct || 0).toFixed(1)}%</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(Number(m.unit_cost || 0))}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${fmt(Number(m.total_cost || 0))}</td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>BOM · Ficha Técnica</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;padding:32px;max-width:900px;margin:auto}
      h1{font-size:20px;margin:0 0 4px}
      .sub{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      thead th{text-align:left;padding:8px;border-bottom:2px solid #333;background:#f6f6f6;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
      .total-card{margin-top:24px;padding:16px 20px;border:2px solid #6366f1;background:#eef2ff;border-radius:10px;display:flex;justify-content:space-between;align-items:center}
      .total-label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#4338ca;font-weight:600}
      .total-value{font-size:26px;font-weight:700;color:#4338ca;font-variant-numeric:tabular-nums}
      @media print { body{padding:12px} .no-print{display:none} }
    </style></head><body>
    <h1>Lista de Materiais (BOM)</h1>
    <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")} · ${data.length} ${data.length === 1 ? "item" : "itens"}</div>
    <table>
      <thead><tr>
        <th></th><th>Tipo</th><th>Material</th><th>Código</th><th>Fornecedor</th><th>Cor</th><th>Un</th>
        <th style="text-align:right">Consumo</th><th style="text-align:right">Perda</th>
        <th style="text-align:right">Custo un.</th><th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total-card">
      <div>
        <div class="total-label">Custo Total de Matéria-Prima</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${data.length} ${data.length === 1 ? "item" : "itens"} no BOM</div>
      </div>
      <div class="total-value">${fmt(total)}</div>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=980,height=800");
  if (!w) {
    toast.error("Popup bloqueado — permita popups para exportar.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
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
        responsible_role: null,
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

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = data.findIndex((o) => o.id === id);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= data.length) return;
      const a = data[idx];
      const b = data[swapIdx];
      // troca posições em lote
      const { error: e1 } = await supabase
        .from("tech_sheet_operations")
        .update({ position: b.position })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("tech_sheet_operations")
        .update({ position: a.position })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-ops", sheetId] }),
    onError: (e: Error) => toast.error(e.message),
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
                <TableHead className="w-40">Responsável</TableHead>
                <TableHead className="w-24 text-right">SAM (min)</TableHead>
                <TableHead className="w-28 text-right">R$ / min</TableHead>
                <TableHead className="w-28 text-right">Custo</TableHead>
                {canEdit && <TableHead className="w-24 text-center">Ordem</TableHead>}
                {canEdit && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o, idx) => (
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
                  <TableCell>
                    {canEdit ? (
                      <select
                        value={o.responsible_role ?? ""}
                        onChange={(e) =>
                          upd.mutate({
                            id: o.id,
                            patch: { responsible_role: e.target.value || null },
                          })
                        }
                        className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        <option value="">—</option>
                        {RESPONSIBLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {o.responsible_role ?? "—"}
                      </span>
                    )}
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
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          title="Mover para cima"
                          disabled={idx === 0 || reorder.isPending}
                          onClick={() => reorder.mutate({ id: o.id, dir: -1 })}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-4 text-center">
                          {idx + 1}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          title="Mover para baixo"
                          disabled={idx === data.length - 1 || reorder.isPending}
                          onClick={() => reorder.mutate({ id: o.id, dir: 1 })}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
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
                <TableCell colSpan={3} className="text-right">
                  Totais
                </TableCell>
                <TableCell className="text-right tabular-nums">{totalSam.toFixed(2)}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{fmt(totalCost)}</TableCell>
                {canEdit && <TableCell />}
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
                    <div className="flex items-center gap-1">
                      <EditableText
                        value={m.point}
                        disabled={!canEdit}
                        onSave={(v) => upd.mutate({ id: m.id, patch: { point: v } })}
                      />
                      <GradeRulePopover
                        sizes={sizes}
                        current={m.sizes || {}}
                        disabled={!canEdit}
                        onApply={(next) => upd.mutate({ id: m.id, patch: { sizes: next } })}
                      />
                    </div>
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

/* --------------------------- Inventory link cell -------------------------- */
type InvItem = { id: string; sku: string | null; name: string; unit: string | null };

function InventoryLinkCell({
  ownerId,
  value,
  disabled,
  onChange,
}: {
  ownerId: string;
  value: string | null;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items-link", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, sku, name, unit")
        .eq("owner_id", ownerId)
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as InvItem[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: current } = useQuery({
    queryKey: ["inventory-item", value],
    queryFn: async () => {
      if (!value) return null;
      const { data } = await supabase
        .from("inventory_items")
        .select("id, sku, name, unit")
        .eq("id", value)
        .maybeSingle();
      return data as InvItem | null;
    },
    enabled: !!value,
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.slice(0, 50);
    return items
      .filter(
        (i) =>
          (i.name?.toLowerCase().includes(t) ?? false) ||
          (i.sku?.toLowerCase().includes(t) ?? false),
      )
      .slice(0, 50);
  }, [items, q]);

  if (!value && disabled) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={(o) => (disabled ? null : setOpen(o))}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex-1 min-w-0 text-left text-xs px-2 py-1 rounded border border-transparent hover:border-border disabled:cursor-default flex items-center gap-1"
            title={
              current ? `${current.sku ?? ""} · ${current.name}` : "Vincular item do almoxarifado"
            }
          >
            <Link2
              className={`size-3 shrink-0 ${current ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className="truncate">
              {current ? (
                (current.sku ?? current.name)
              ) : (
                <span className="text-muted-foreground">Vincular…</span>
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="flex items-center border-b px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar SKU ou nome…"
              className="h-8 border-0 focus-visible:ring-0 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">Nada encontrado.</div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center justify-between gap-2"
                  onClick={() => {
                    onChange(it.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="truncate">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {it.sku ?? "—"}
                    </span>{" "}
                    {it.name}
                  </span>
                  {it.unit && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{it.unit}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          onClick={() => onChange(null)}
          title="Desvincular"
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

function SizeConsumptionPopover({
  value,
  disabled,
  onSave,
}: {
  value: Record<string, number> | null;
  disabled: boolean;
  onSave: (v: Record<string, number> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const initial = useMemo(() => {
    if (!value || Object.keys(value).length === 0) return "";
    return Object.entries(value)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
  }, [value]);
  const [text, setText] = useState(initial);
  const active = !!value && Object.keys(value).length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={active ? "default" : "ghost"}
              className="size-6 shrink-0 text-[10px]"
              disabled={disabled}
              title="Consumo por tamanho"
              onClick={() => setText(initial)}
            >
              <Ruler className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Definir consumo específico por tamanho (ex.: P=1.2m, M=1.35m, G=1.5m). Sobrepõe o
            consumo médio para cada faixa da grade.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-72 space-y-2">
        <div className="text-xs font-semibold">Consumo por tamanho</div>
        <p className="text-[11px] text-muted-foreground">
          Formato: <code>P:1.2, M:1.35, G:1.5, GG:1.7</code>. Sobrepõe o consumo médio para cada
          tamanho na grade. Deixe em branco para usar a média.
        </p>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="P:1.2, M:1.35, G:1.5"
          className="h-8 text-xs font-mono"
        />
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onSave(null);
              setOpen(false);
            }}
          >
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const parsed: Record<string, number> = {};
              for (const pair of text.split(/[,;\n]/)) {
                const [k, v] = pair.split(":").map((s) => s.trim());
                if (!k || !v) continue;
                const n = Number(v.replace(",", "."));
                if (Number.isFinite(n) && n > 0) parsed[k] = n;
              }
              onSave(Object.keys(parsed).length > 0 ? parsed : null);
              setOpen(false);
            }}
          >
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------- Grade rule popover --------------------------- */
/**
 * Regra de Salto entre tamanhos: usuário escolhe o tamanho base e o incremento
 * (em cm) para cada faixa adjacente. Ex.: base M=48, PP→P +1.5, P→M +2,
 * M→G +2, G→GG +3. O componente calcula os valores para todos os tamanhos
 * da grade a partir da base, propagando +Δ para tamanhos maiores e −Δ para
 * menores, e salva a coluna `sizes` em batch.
 */
function GradeRulePopover({
  sizes,
  current,
  disabled,
  onApply,
}: {
  sizes: string[];
  current: Record<string, number>;
  disabled: boolean;
  onApply: (next: Record<string, number>) => void;
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
  // deltas[i] = incremento entre sizes[i] e sizes[i+1]
  const [deltas, setDeltas] = useState<string[]>(() =>
    Array(Math.max(0, sizes.length - 1)).fill("2"),
  );

  // resync when opening
  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      const b =
        current && Object.keys(current).length > 0
          ? (sizes.find((s) => s === "M") ?? sizes[Math.floor(sizes.length / 2)] ?? sizes[0] ?? "")
          : pickDefaultBase();
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
    // maiores
    let acc = bv;
    for (let i = idxBase; i < sizes.length - 1; i++) {
      const d = Number(String(deltas[i] ?? "0").replace(",", "."));
      acc = +(acc + (Number.isFinite(d) ? d : 0)).toFixed(2);
      result[sizes[i + 1]] = acc;
    }
    // menores
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
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              disabled={disabled}
              title="Aplicar regra de salto"
            >
              <span className="text-[11px] font-semibold text-primary">Δ</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Aplicar regra de salto: defina o tamanho base e os incrementos automáticos entre as
            faixas da grade.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div>
          <div className="text-xs font-semibold">Regra de salto</div>
          <p className="text-[11px] text-muted-foreground">
            Defina o tamanho base e o incremento entre cada faixa. Os demais tamanhos são
            preenchidos automaticamente.
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
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Valor base (cm)</Label>
            <Input
              value={baseValue}
              onChange={(e) => setBaseValue(e.target.value)}
              className="h-8 text-xs text-right tabular-nums"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Incrementos entre faixas (cm)</Label>
          <div className="space-y-1">
            {sizes.slice(0, -1).map((s, i) => (
              <div key={`${s}-${sizes[i + 1]}`} className="flex items-center gap-2">
                <span className="text-[11px] font-mono w-16 text-muted-foreground">
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
        </div>

        <div className="rounded-md border border-border/60 bg-muted/30 p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Prévia
          </div>
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
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(preview);
              setOpen(false);
            }}
          >
            Aplicar salto
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
