import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, Trash2, Pencil, Sparkles, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · USE MODA OS" },
      { name: "description", content: "Fluxo de caixa e contas a pagar/receber." },
    ],
  }),
  component: Financeiro,
});

type AccType = "pagar" | "receber";
type AccStatus = "pendente" | "pago" | "atrasado" | "cancelado";
type Account = {
  id: string; owner_id: string; type: AccType; description: string;
  due_date: string; value: number; status: AccStatus; notes: string | null;
};

const STATUS_LABEL: Record<AccStatus, string> = {
  pendente: "Pendente", pago: "Pago", atrasado: "Atrasado", cancelado: "Cancelado",
};
const STATUS_STYLE: Record<AccStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-400",
  pago: "bg-emerald-500/15 text-emerald-400",
  atrasado: "bg-destructive/15 text-destructive",
  cancelado: "bg-muted text-muted-foreground",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Financeiro() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["financial_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_accounts").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data as Account[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_accounts"] }); toast.success("Lançamento removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const receber = rows.filter((r) => r.type === "receber" && r.status === "pendente").reduce((a, b) => a + Number(b.value), 0);
    const pagar = rows.filter((r) => r.type === "pagar" && r.status === "pendente").reduce((a, b) => a + Number(b.value), 0);
    const saldo = receber - pagar;
    return { receber, pagar, saldo };
  }, [rows]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Wallet className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Contas a pagar e receber</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv("financeiro", rows.map((r) => ({ ...r, type: r.type === "receber" ? "Receber" : "Pagar", status: STATUS_LABEL[r.status] })), [
            { key: "type", label: "Tipo" }, { key: "description", label: "Descrição" },
            { key: "due_date", label: "Vencimento" }, { key: "status", label: "Status" },
            { key: "value", label: "Valor" }, { key: "notes", label: "Observações" },
          ])} disabled={!rows.length} className="gap-2"><Download className="size-4" />Exportar CSV</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Novo lançamento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">A receber (pendente)</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums text-emerald-400">{brl(totals.receber)}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">A pagar (pendente)</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums text-destructive">{brl(totals.pagar)}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Saldo projetado</div>
          <div className={`text-2xl font-semibold mt-1 tabular-nums ${totals.saldo >= 0 ? "text-emerald-400" : "text-destructive"}`}>{brl(totals.saldo)}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Sem lançamentos</h3>
          <p className="text-sm text-muted-foreground mb-4">Cadastre seu primeiro título.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>Novo lançamento</Button>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Tipo</th>
                  <th className="text-left font-medium px-5 py-2.5">Descrição</th>
                  <th className="text-left font-medium px-5 py-2.5">Vencimento</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5">Valor</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mine = r.owner_id === user?.id;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${r.type === "receber" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`}>
                          {r.type === "receber" ? "Receber" : "Pagar"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium">{r.description}</td>
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">{new Date(r.due_date).toLocaleDateString("pt-BR")}</td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">{brl(Number(r.value))}</td>
                      <td className="px-5 py-3 text-right">
                        {mine && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditing(r); setOpen(true); }} className="size-7 grid place-items-center rounded hover:bg-muted">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => confirm("Remover este lançamento?") && deleteMut.mutate(r.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AccDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function AccDialog({ open, onOpenChange, editing, userId }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Account | null; userId?: string;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<AccType>("pagar");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("0");
  const [status, setStatus] = useState<AccStatus>("pendente");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && editing) {
      setType(editing.type); setDescription(editing.description);
      setDueDate(editing.due_date.slice(0, 10)); setValue(String(editing.value));
      setStatus(editing.status); setNotes(editing.notes || "");
    } else if (open) {
      setType("pagar"); setDescription(""); setDueDate(new Date().toISOString().slice(0, 10));
      setValue("0"); setStatus("pendente"); setNotes("");
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = { type, description, due_date: dueDate, value: Number(value), status, notes: notes || null };
      if (editing) {
        const { error } = await supabase.from("financial_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_accounts").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_accounts"] });
      toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>Conta a pagar ou receber.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">A pagar</SelectItem>
                  <SelectItem value="receber">A receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AccStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as AccStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required /></div>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
