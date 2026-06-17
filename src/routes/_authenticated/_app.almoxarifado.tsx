import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { Boxes, AlertTriangle, Search, Plus, Trash2, Pencil, Sparkles, Download, Zap, ArrowRight } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/_app/almoxarifado")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string().trim().max(80), "").default("") })),
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
  balance: number; minimum: number; maximum: number; notes: string | null;
  last_entry_at: string | null; last_exit_at: string | null; turnover_30d: number;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `${days}d`;
  return new Date(d).toLocaleDateString("pt-BR");
}

const CAT_LABEL: Record<Category, string> = {
  tecido: "Tecido", aviamento: "Aviamento", acabado: "Acabado", outros: "Outros",
};

const LEAD_TIME_DAYS = 14; // padrão; futuramente por fornecedor

/** Ponto de pedido = consumo diário (giro 30d / 30) × lead time + estoque de segurança (mínimo). */
function reorderPoint(turnover30d: number, minimum: number, leadDays = LEAD_TIME_DAYS): number {
  const daily = (Number(turnover30d) || 0) / 30;
  return Math.ceil(daily * leadDays + (Number(minimum) || 0));
}

function Almoxarifado() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("inventory_items", ["inventory_items"]);
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setQ = (v: string) => navigate({ search: (p: { q: string }) => ({ ...p, q: v }), replace: true });
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
  const noPontoPedido = items.filter((i) => {
    const bal = Number(i.balance), min = Number(i.minimum);
    const pp = reorderPoint(Number(i.turnover_30d || 0), min);
    return bal >= min && bal <= pp && pp > min;
  }).length;
  const totalSaldo = items.reduce((s, i) => s + Number(i.balance || 0), 0);
  const byCat = (Object.keys(CAT_LABEL) as Category[]).map((c) => ({
    cat: c,
    qty: items.filter((i) => i.category === c).length,
    saldo: items.filter((i) => i.category === c).reduce((s, i) => s + Number(i.balance || 0), 0),
  }));
  const criticosList = items.filter((i) => Number(i.balance) < Number(i.minimum)).slice(0, 5);

  // Reposição inteligente: usa ponto de pedido (lead-time + segurança) e giro 30d
  const reposicao = useMemo(() => {
    return items
      .map((i) => {
        const bal = Number(i.balance), min = Number(i.minimum), max = Number(i.maximum), giro = Number(i.turnover_30d || 0);
        const pp = reorderPoint(giro, min);
        const sugerido = max > 0 ? Math.max(0, max - bal) : Math.max(0, pp * 2 - bal);
        const diasCobertura = giro > 0 ? Math.round((bal / giro) * 30) : null;
        const urgencia: "alta" | "media" | null =
          bal < min ? "alta" : bal <= pp && pp > min ? "media" : null;
        return { ...i, sugerido, diasCobertura, urgencia, pp };
      })
      .filter((i) => i.urgencia && i.sugerido > 0)
      .sort((a, b) => (a.urgencia === "alta" ? -1 : 1) - (b.urgencia === "alta" ? -1 : 1) || Number(b.turnover_30d || 0) - Number(a.turnover_30d || 0))
      .slice(0, 6);
  }, [items]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv("almoxarifado", items, [
            { key: "sku", label: "SKU" }, { key: "name", label: "Nome" }, { key: "category", label: "Categoria" },
            { key: "deposit", label: "Depósito" }, { key: "unit", label: "Unidade" },
            { key: "balance", label: "Saldo" }, { key: "minimum", label: "Mínimo" }, { key: "notes", label: "Observações" },
          ])} disabled={!items.length} className="gap-2"><Download className="size-4" />Exportar CSV</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Novo item
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="rounded-xl border border-border bg-card/50 p-4 col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Saldo total</div>
            <div className="text-2xl font-semibold tabular-nums">{totalSaldo.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">{items.length} SKUs ativos</div>
          </div>
          {byCat.map((b) => (
            <div key={b.cat} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{CAT_LABEL[b.cat]}</div>
              <div className="text-xl font-semibold tabular-nums">{b.qty}</div>
              <div className="text-xs text-muted-foreground">saldo {b.saldo.toLocaleString("pt-BR")}</div>
            </div>
          ))}
        </div>
      )}

      {criticosList.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive font-medium mb-2">
            <AlertTriangle className="size-4" /> {criticos} item(s) abaixo do mínimo
          </div>
          <div className="flex flex-wrap gap-2">
            {criticosList.map((i) => (
              <span key={i.id} className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive">
                {i.sku} · {i.name} ({i.balance}/{i.minimum} {i.unit})
              </span>
            ))}
          </div>
        </div>
      )}

      {reposicao.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 font-medium">
              <Zap className="size-4 text-primary" /> Reposição inteligente sugerida
              <span className="text-xs text-muted-foreground font-normal">cruza saldo, mínimo, máximo e giro 30d</span>
            </div>
            <Link to="/pedidos-compra" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Criar pedidos <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {reposicao.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card/60 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.sku} · saldo {Number(r.balance)} {r.unit}
                    {r.diasCobertura !== null && ` · cobre ${r.diasCobertura}d`}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold tabular-nums ${r.urgencia === "alta" ? "text-destructive" : "text-amber-500"}`}>
                    +{r.sugerido} {r.unit}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.urgencia === "alta" ? "Urgente" : "Planejar"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <th className="text-right font-medium px-5 py-2.5">Saldo</th>
                  <th className="text-right font-medium px-5 py-2.5">Mín / Máx</th>
                  <th className="text-right font-medium px-5 py-2.5" title="Saídas últimos 30 dias">Giro 30d</th>
                  <th className="text-right font-medium px-5 py-2.5">Últ. entrada</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const bal = Number(i.balance);
                  const min = Number(i.minimum);
                  const max = Number(i.maximum);
                  const critico = bal < min;
                  const excesso = max > 0 && bal > max;
                  const mine = i.owner_id === user?.id;
                  return (
                    <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">{i.sku}</td>
                      <td className="px-5 py-3 font-medium">{i.name}<div className="text-xs text-muted-foreground">{i.deposit || "—"}</div></td>
                      <td className="px-5 py-3 text-muted-foreground">{CAT_LABEL[i.category]}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${critico ? "text-destructive font-medium" : excesso ? "text-amber-500" : ""}`}>{bal} {i.unit}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{min} / {max || "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{Number(i.turnover_30d || 0)} {i.unit}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground text-xs">{fmtDate(i.last_entry_at)}</td>
                      <td className="px-5 py-3">
                        {critico
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive"><AlertTriangle className="size-3" /> Crítico</span>
                          : excesso
                          ? <span className="px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-500">Excesso</span>
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
  const [maximum, setMaximum] = useState("0");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [supplierColor, setSupplierColor] = useState("");
  const [internalColor, setInternalColor] = useState("");
  const [techSheetPdfUrl, setTechSheetPdfUrl] = useState("");

  useEffect(() => {
    if (open && editing) {
      const e = editing as Item & { photo_url?: string | null; supplier_color?: string | null; internal_color?: string | null; tech_sheet_pdf_url?: string | null };
      setSku(e.sku); setName(e.name); setCategory(e.category);
      setDeposit(e.deposit || ""); setUnit(e.unit);
      setBalance(String(e.balance)); setMinimum(String(e.minimum));
      setMaximum(String(e.maximum || 0));
      setNotes(e.notes || "");
      setPhotoUrl(e.photo_url || ""); setSupplierColor(e.supplier_color || "");
      setInternalColor(e.internal_color || ""); setTechSheetPdfUrl(e.tech_sheet_pdf_url || "");
    } else if (open) {
      setSku(""); setName(""); setCategory("tecido"); setDeposit(""); setUnit("un");
      setBalance("0"); setMinimum("0"); setMaximum("0"); setNotes("");
      setPhotoUrl(""); setSupplierColor(""); setInternalColor(""); setTechSheetPdfUrl("");
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        sku, name, category, deposit: deposit || null, unit,
        balance: Number(balance), minimum: Number(minimum), maximum: Number(maximum),
        notes: notes || null,
        photo_url: photoUrl || null,
        supplier_color: supplierColor || null,
        internal_color: internalColor || null,
        tech_sheet_pdf_url: techSheetPdfUrl || null,
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
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2"><Label>Unidade</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="m, kg, un" /></div>
            <div className="space-y-2"><Label>Saldo</Label><Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>
            <div className="space-y-2"><Label>Mínimo</Label><Input type="number" step="0.01" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></div>
            <div className="space-y-2"><Label>Máximo</Label><Input type="number" step="0.01" value={maximum} onChange={(e) => setMaximum(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Material · ficha</div>
            <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
              {photoUrl ? (
                <img src={photoUrl} alt={name || "Material"} className="size-[120px] rounded-lg border border-border object-cover" />
              ) : (
                <div className="size-[120px] rounded-lg border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground text-center px-2">
                  Cole URL ao lado para visualizar
                </div>
              )}
              <div className="space-y-2">
                <Label>Foto do material (URL)</Label>
                <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Cor fornecedor</Label><Input value={supplierColor} onChange={(e) => setSupplierColor(e.target.value)} placeholder="Ex: Azul Marinho 4521" /></div>
              <div className="space-y-2"><Label>Cor interna</Label><Input value={internalColor} onChange={(e) => setInternalColor(e.target.value)} placeholder="Ex: AZ-MAR" /></div>
            </div>
            <div className="space-y-2">
              <Label>PDF da ficha técnica (URL)</Label>
              <Input value={techSheetPdfUrl} onChange={(e) => setTechSheetPdfUrl(e.target.value)} placeholder="https://…/ficha.pdf" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
