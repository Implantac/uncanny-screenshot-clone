import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldAlert,
  Plus,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  listCapas,
  upsertCapa,
  deleteCapa,
  listReinspectionsForCapa,
  createReinspectionFromCapa,
  verifyCapaFromReinspection,
  type CapaRow,
} from "@/lib/quality-capa.functions";
import { RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCapas, upsertCapa, deleteCapa, type CapaRow } from "@/lib/quality-capa.functions";
import { toast } from "sonner";

const sevTone: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-warning/15 text-warning",
  alta: "bg-destructive/15 text-destructive",
  critica: "bg-destructive text-destructive-foreground",
};
const statusTone: Record<string, string> = {
  aberta: "bg-warning/15 text-warning",
  em_andamento: "bg-primary/15 text-primary",
  concluida: "bg-success/15 text-success",
  verificada: "bg-success text-success-foreground",
  cancelada: "bg-muted text-muted-foreground",
};

type CapaForm = {
  title: string;
  problem: string;
  root_cause: string;
  corrective_action: string;
  preventive_action: string;
  severity: CapaRow["severity"];
  status: CapaRow["status"];
  due_date: string;
  effectiveness_check: string;
};

export function CapaPanel() {
  const list = useServerFn(listCapas);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["capas", filter],
    queryFn: () => list({ data: filter === "all" ? {} : { status: filter } }),
  });

  const counts = {
    aberta: rows.filter((r) => r.status === "aberta").length,
    em_andamento: rows.filter((r) => r.status === "em_andamento").length,
    overdue: rows.filter(
      (r) =>
        r.due_date &&
        new Date(r.due_date) < new Date() &&
        !["concluida", "verificada", "cancelada"].includes(r.status),
    ).length,
    verificada: rows.filter((r) => r.status === "verificada").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard icon={AlertOctagon} label="Abertas" value={counts.aberta} tone="warning" />
        <MiniCard icon={Clock} label="Em andamento" value={counts.em_andamento} tone="primary" />
        <MiniCard icon={ShieldAlert} label="Atrasadas" value={counts.overdue} tone="destructive" />
        <MiniCard
          icon={CheckCircle2}
          label="Verificadas"
          value={counts.verificada}
          tone="success"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="verificada">Verificadas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <CapaDialog onSaved={() => qc.invalidateQueries({ queryKey: ["capas"] })}>
          <Button size="sm">
            <Plus className="size-4 mr-1" />
            Nova CAPA
          </Button>
        </CapaDialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="size-4" /> Ações corretivas & preventivas
          </CardTitle>
          <CardDescription>
            Fecha o ciclo da não-conformidade: causa raiz, ação, responsável, prazo e verificação de
            eficácia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma CAPA registrada. Use o botão acima para criar a primeira.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((c) => (
                <CapaItem
                  key={c.id}
                  c={c}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["capas"] })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
}) {
  const tones: Record<string, string> = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-xl border border-border p-3 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function CapaItem({ c, onChanged }: { c: CapaRow; onChanged: () => void }) {
  const del = useServerFn(deleteCapa);
  const delMut = useMutation({
    mutationFn: () => del({ data: { id: c.id } }),
    onSuccess: () => {
      toast.success("CAPA excluída");
      onChanged();
    },
  });
  const overdue =
    c.due_date &&
    new Date(c.due_date) < new Date() &&
    !["concluida", "verificada", "cancelada"].includes(c.status);
  return (
    <div className="border border-border rounded-lg p-3 hover:bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{c.title}</span>
            <Badge className={statusTone[c.status]}>{c.status.replace("_", " ")}</Badge>
            <Badge className={sevTone[c.severity]}>{c.severity}</Badge>
            {overdue && (
              <Badge variant="destructive" className="text-[10px]">
                atrasada
              </Badge>
            )}
            {c.supplier_name && (
              <span className="text-xs text-muted-foreground">· {c.supplier_name}</span>
            )}
            {c.order_code && (
              <span className="text-xs font-mono text-muted-foreground">· {c.order_code}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.problem}</p>
          {c.due_date && (
            <div className="text-[11px] text-muted-foreground mt-1">
              Prazo: {new Date(c.due_date).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CapaDialog capa={c} onSaved={onChanged}>
            <Button size="sm" variant="outline">
              Abrir
            </Button>
          </CapaDialog>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (confirm("Excluir CAPA?")) delMut.mutate();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CapaDialog({
  children,
  capa,
  onSaved,
}: {
  children: React.ReactNode;
  capa?: CapaRow;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CapaForm>(() => ({
    title: capa?.title ?? "",
    problem: capa?.problem ?? "",
    root_cause: capa?.root_cause ?? "",
    corrective_action: capa?.corrective_action ?? "",
    preventive_action: capa?.preventive_action ?? "",
    severity: capa?.severity ?? "media",
    status: capa?.status ?? "aberta",
    due_date: capa?.due_date ?? "",
    effectiveness_check: capa?.effectiveness_check ?? "",
  }));
  const save = useServerFn(upsertCapa);
  const mut = useMutation({
    mutationFn: () => save({ data: { ...form, id: capa?.id, due_date: form.due_date || null } }),
    onSuccess: () => {
      toast.success("CAPA salva");
      setOpen(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{capa ? "Editar CAPA" : "Nova CAPA"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Título"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            placeholder="Problema / não-conformidade observada"
            rows={2}
            value={form.problem}
            onChange={(e) => setForm({ ...form, problem: e.target.value })}
          />
          <Textarea
            placeholder="Causa raiz (5 porquês, Ishikawa, etc.)"
            rows={2}
            value={form.root_cause}
            onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
          />
          <Textarea
            placeholder="Ação corretiva (o que fazer agora)"
            rows={2}
            value={form.corrective_action}
            onChange={(e) => setForm({ ...form, corrective_action: e.target.value })}
          />
          <Textarea
            placeholder="Ação preventiva (impedir recorrência)"
            rows={2}
            value={form.preventive_action}
            onChange={(e) => setForm({ ...form, preventive_action: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="verificada">Verificada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          {(form.status === "concluida" || form.status === "verificada") && (
            <Textarea
              placeholder="Verificação de eficácia (evidência de que funcionou)"
              rows={2}
              value={form.effectiveness_check}
              onChange={(e) => setForm({ ...form, effectiveness_check: e.target.value })}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.title || !form.problem}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
