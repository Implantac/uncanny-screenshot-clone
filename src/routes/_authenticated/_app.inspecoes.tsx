import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

export const Route = createFileRoute("/_authenticated/_app/inspecoes")({
  head: () => ({
    meta: [
      { title: "Inspeções de Qualidade · USE MODA PLM" },
      {
        name: "description",
        content: "Inspeções AQL por OP/OS/protótipo com defeitos críticos, maiores e menores.",
      },
    ],
  }),
  component: InspectionsPage,
});

type Inspection = {
  id: string;
  inspection_type: string;
  aql_level: string | null;
  lot_size: number | null;
  sample_size: number | null;
  critical_defects: number;
  major_defects: number;
  minor_defects: number;
  result: string;
  inspector: string | null;
  notes: string | null;
  inspected_at: string;
  supplier_id: string | null;
  production_order_id: string | null;
  service_order_id: string | null;
  prototype_id: string | null;
};

const RESULTS = ["pendente", "aprovado", "refacao", "reprovado"] as const;
const AQL = ["I", "II", "III", "S-1", "S-2", "S-3", "S-4"] as const;

function resultBadge(r: string) {
  const v = r === "aprovado" ? "default" : r === "reprovado" ? "destructive" : "secondary";
  return <Badge variant={v}>{r}</Badge>;
}

function InspectionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const insps = useQuery({
    queryKey: ["quality_inspections"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("quality_inspections")
        .select("*")
        .order("inspected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inspection[];
    },
  });

  const suppliers = useQuery({
    queryKey: ["insp-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const pos = useQuery({
    queryKey: ["insp-pos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select("id, code")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as { id: string; code: string }[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("quality_inspections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quality_inspections"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Qualidade"
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="size-6 text-primary" /> Inspeções de Qualidade
          </span>
        }
        description="Plano AQL por ordem, com classificação de defeitos e laudo."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1" /> Nova inspeção
          </Button>
        }
      />


      <InspectionsTable
        data={insps.data ?? []}
        loading={insps.isLoading}
        pos={pos.data ?? []}
        onDelete={(id) => del.mutate(id)}
      />


      <NewInspectionDialog
        open={open}
        onOpenChange={setOpen}
        userId={user?.id ?? ""}
        suppliers={suppliers.data ?? []}
        pos={pos.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["quality_inspections"] })}
      />
    </div>
  );
}

function InspectionsTable({
  data,
  loading,
  pos,
  onDelete,
}: {
  data: Inspection[];
  loading: boolean;
  pos: { id: string; code: string }[];
  onDelete: (id: string) => void;
}) {
  const columns: DataTableColumn<Inspection>[] = [
    {
      key: "inspected_at",
      header: "Data",
      value: (r) => r.inspected_at,
      cell: (r) => new Date(r.inspected_at).toLocaleDateString("pt-BR"),
    },
    {
      key: "inspection_type",
      header: "Tipo",
      value: (r) => r.inspection_type,
      cell: (r) => r.inspection_type,
    },
    {
      key: "op",
      header: "OP",
      value: (r) => pos.find((p) => p.id === r.production_order_id)?.code ?? "",
      cell: (r) => (
        <span className="font-mono">
          {pos.find((p) => p.id === r.production_order_id)?.code ?? "—"}
        </span>
      ),
    },
    {
      key: "aql_level",
      header: "AQL",
      value: (r) => r.aql_level ?? "",
      cell: (r) => r.aql_level ?? "—",
    },
    {
      key: "lot",
      header: "Lote / Amostra",
      cell: (r) => `${r.lot_size ?? "—"} / ${r.sample_size ?? "—"}`,
    },
    {
      key: "defects",
      header: "Críticos / Maiores / Menores",
      value: (r) => r.critical_defects,
      cell: (r) => (
        <>
          <span className="text-destructive font-medium">{r.critical_defects}</span>
          {" / "}
          <span>{r.major_defects}</span>
          {" / "}
          <span className="text-muted-foreground">{r.minor_defects}</span>
        </>
      ),
    },
    {
      key: "result",
      header: "Resultado",
      value: (r) => r.result,
      cell: (r) => resultBadge(r.result),
    },
    {
      key: "inspector",
      header: "Inspetor",
      value: (r) => r.inspector ?? "",
      cell: (r) => <span className="text-muted-foreground">{r.inspector ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Excluir inspeção"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r.id);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={loading}
      getRowId={(r) => r.id}
      initialSort={{ key: "inspected_at", dir: "desc" }}
      searchPlaceholder="Buscar por tipo, OP, AQL, inspetor…"
      emptyTitle="Nenhuma inspeção registrada"
      emptyDescription="Registre uma nova inspeção AQL para começar."
      emptyIcon={ShieldAlert}
      pageSize={20}
    />
  );
}

function NewInspectionDialog({
  open,
  onOpenChange,
  userId,
  suppliers,
  pos,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  suppliers: { id: string; name: string }[];
  pos: { id: string; code: string }[];
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    inspection_type: "final",
    production_order_id: "",
    supplier_id: "",
    aql_level: "II",
    lot_size: "",
    sample_size: "",
    critical_defects: "0",
    major_defects: "0",
    minor_defects: "0",
    result: "pendente",
    inspector: "",
    notes: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        owner_id: userId,
        inspection_type: f.inspection_type,
        production_order_id: f.production_order_id || null,
        supplier_id: f.supplier_id || null,
        aql_level: f.aql_level || null,
        lot_size: f.lot_size ? Number(f.lot_size) : null,
        sample_size: f.sample_size ? Number(f.sample_size) : null,
        critical_defects: Number(f.critical_defects || 0),
        major_defects: Number(f.major_defects || 0),
        minor_defects: Number(f.minor_defects || 0),
        result: f.result,
        inspector: f.inspector || null,
        notes: f.notes || null,
      };
      const { error } = await (supabase as any).from("quality_inspections").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inspeção registrada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova inspeção</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select
              value={f.inspection_type}
              onValueChange={(v) => setF({ ...f, inspection_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inicial">Inicial</SelectItem>
                <SelectItem value="durante">Durante produção</SelectItem>
                <SelectItem value="final">Final</SelectItem>
                <SelectItem value="prototipo">Protótipo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">AQL</label>
            <Select value={f.aql_level} onValueChange={(v) => setF({ ...f, aql_level: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AQL.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ordem de Produção</label>
            <Select
              value={f.production_order_id}
              onValueChange={(v) => setF({ ...f, production_order_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {pos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fornecedor</label>
            <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tamanho do lote</label>
            <Input
              type="number"
              value={f.lot_size}
              onChange={(e) => setF({ ...f, lot_size: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amostra</label>
            <Input
              type="number"
              value={f.sample_size}
              onChange={(e) => setF({ ...f, sample_size: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Defeitos críticos</label>
            <Input
              type="number"
              value={f.critical_defects}
              onChange={(e) => setF({ ...f, critical_defects: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Defeitos maiores</label>
            <Input
              type="number"
              value={f.major_defects}
              onChange={(e) => setF({ ...f, major_defects: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Defeitos menores</label>
            <Input
              type="number"
              value={f.minor_defects}
              onChange={(e) => setF({ ...f, minor_defects: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Resultado</label>
            <Select value={f.result} onValueChange={(v) => setF({ ...f, result: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Inspetor</label>
            <Input
              value={f.inspector}
              onChange={(e) => setF({ ...f, inspector: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
