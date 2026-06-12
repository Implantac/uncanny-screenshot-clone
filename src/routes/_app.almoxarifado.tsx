import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, AlertTriangle, Search, Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/almoxarifado")({
  head: () => ({
    meta: [
      { title: "Almoxarifado · USE MODA OS" },
      { name: "description", content: "Estoque de tecidos, aviamentos e produtos acabados." },
    ],
  }),
  component: Almoxarifado,
});

type Category = "tecido" | "aviamento" | "acabado" | "outros";
type Item = {
  id: string; owner_id: string; sku: string; name: string;
  category: Category; deposit: string | null; unit: string;
  balance: number; minimum: number; notes: string | null;
};

const CAT_LABEL: Record<Category, string> = {
  tecido: "Tecido", aviamento: "Aviamento", acabado: "Acabado", outros: "Outros",
};

function Almoxarifado() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Item[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_items"] }); toast.success("Item removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(q.toLowerCase()) || i.sku.toLowerCase().includes(q.toLowerCase())
  );
  const criticos = items.filter((i) => Number(i.balance) < Number(i.minimum)).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Boxes className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Almoxarifado</h1>
            <p className="text-sm text-muted-foreground">{items.length} SKUs · {criticos} em nível crítico</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="size-4" /> Novo item
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Estoque vazio</h3>
          <p className="text-sm text-muted-foreground mb-4">Cadastre o primeiro item.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>Cadastrar item</Button>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold">Inventário</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar SKU ou nome…"
                className="w-72 h-9 pl-8 pr-3 rounded-md bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">SKU</th>
                  <th className="text-left font-medium px-5 py-2.5">Item</th>
                  <th className="text-left font-medium px-5 py-2.5">Categoria</th>
                  <th className="text-left font-medium px-5 py-2.5">Depósito</th>
                  <th className="text-right font-medium px-5 py-2.5">Saldo</th>
                  <th className="text-right font-medium px-5 py-2.5">Mínimo</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const critico = Number(i.balance) < Number(i.minimum);
                  const mine = i.owner_id === user?.id;
                  return (
                    <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">{i.sku}</td>
                      <td className="px-5 py-3 font-medium">{i.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{CAT_LABEL[i.category]}</td>
                      <td className="px-5 py-3 text-muted-foreground">{i.deposit || "—"}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${critico ? "text-destructive font-medium" : ""}`}>{i.balance} {i.unit}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{i.minimum} {i.unit}</td>
                      <td className="px-5 py-3">
                        {critico
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive"><AlertTriangle className="size-3" /> Crítico</span>
                          : <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-400">Ok</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {mine && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditing(i); setOpen(true); }} className="size-7 grid place-items-center rounded hover:bg-muted">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => confirm("Remover este item?") && deleteMut.mutate(i.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive">
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

      <ItemDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function ItemDialog({ open, onOpenChange, editing, userId }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Item | null; userId?: string;
}) {
  const qc = useQueryClient();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("tecido");
  const [deposit, setDeposit] = useState("");
  const [unit, setUnit] = useState("un");
  const [balance, setBalance] = useState("0");
  const [minimum, setMinimum] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && editing) {
      setSku(editing.sku); setName(editing.name); setCategory(editing.category);
      setDeposit(editing.deposit || ""); setUnit(editing.unit);
      setBalance(String(editing.balance)); setMinimum(String(editing.minimum));
      setNotes(editing.notes || "");
    } else if (open) {
      setSku(""); setName(""); setCategory("tecido"); setDeposit(""); setUnit("un");
      setBalance("0"); setMinimum("0"); setNotes("");
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        sku, name, category, deposit: deposit || null, unit,
        balance: Number(balance), minimum: Number(minimum), notes: notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success(editing ? "Item atualizado" : "Item criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle>
          <DialogDescription>Cadastro de SKU no almoxarifado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-2"><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>{CAT_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Depósito</Label><Input value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="DP-01" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Unidade</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="m, kg, un" /></div>
            <div className="space-y-2"><Label>Saldo</Label><Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>
            <div className="space-y-2"><Label>Mínimo</Label><Input type="number" step="0.01" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></div>
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
