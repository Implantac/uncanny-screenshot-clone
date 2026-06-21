import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Trash2,
  CalendarClock,
  PackageMinus,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getScrapsSummary,
  registerScrap,
  getExpiringLots,
} from "@/lib/inventory-fefo.functions";

type ItemLite = { id: string; sku: string; name: string; unit: string };

const REASONS: Array<{ value: "vencimento" | "avaria" | "qualidade" | "sobra_corte" | "outros"; label: string }> = [
  { value: "vencimento", label: "Vencimento" },
  { value: "avaria", label: "Avaria" },
  { value: "qualidade", label: "Qualidade" },
  { value: "sobra_corte", label: "Sobra de corte" },
  { value: "outros", label: "Outros" },
];

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function InventoryScrapsPanel() {
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getScrapsSummary);
  const fetchExpiring = useServerFn(getExpiringLots);
  const doScrap = useServerFn(registerScrap);

  const summary = useQuery({
    queryKey: ["inv-scraps-summary", 30],
    queryFn: () => fetchSummary({ data: { windowDays: 30 } }),
  });
  const expiring = useQuery({
    queryKey: ["inv-expiring-lots", 15],
    queryFn: () => fetchExpiring({ data: { daysAhead: 15 } }),
  });
  const items = useQuery({
    queryKey: ["inv-items-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, sku, name, unit")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ItemLite[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    itemId: "",
    quantity: "",
    reason: "avaria" as (typeof REASONS)[number]["value"],
    costValue: "",
    notes: "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.itemId) throw new Error("Selecione o item");
      const q = Number(form.quantity);
      if (!q || q <= 0) throw new Error("Quantidade inválida");
      return doScrap({
        data: {
          itemId: form.itemId,
          quantity: q,
          reason: form.reason,
          costValue: form.costValue ? Number(form.costValue) : null,
          notes: form.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Perda registrada");
      setOpen(false);
      setForm({ itemId: "", quantity: "", reason: "avaria", costValue: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["inv-scraps-summary"] });
      qc.invalidateQueries({ queryKey: ["inv-expiring-lots"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory_lot_breakdown"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = summary.data;
  const exp = expiring.data ?? [];

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-destructive/10 grid place-items-center">
            <TrendingDown className="size-4 text-destructive" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Perdas & vencimentos</h2>
            <p className="text-xs text-muted-foreground">
              Janela {data?.windowDays ?? 30} dias · {data?.totals.count ?? 0} registros ·{" "}
              {fmtCurrency(data?.totals.cost ?? 0)}
            </p>
          </div>
        </div>
        <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
          <PackageMinus className="size-3.5 mr-1.5" /> Registrar perda
        </Button>
      </div>

      {exp.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
            <CalendarClock className="size-3.5" />
            Lotes vencendo nos próximos 15 dias ({exp.length})
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {exp.slice(0, 6).map((l) => {
              const days = Math.ceil(
                (new Date(l.expiresAt).getTime() - Date.now()) / 86400_000,
              );
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between text-xs rounded bg-background/40 px-2 py-1"
                >
                  <span className="truncate">
                    <span className="font-mono">{l.sku}</span> · {l.name} · lote{" "}
                    <span className="font-mono">{l.lotCode}</span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold ${days <= 3 ? "text-destructive" : "text-amber-600"}`}
                  >
                    {l.quantity}
                    {l.unit} · {days}d
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Pareto por motivo
          </div>
          <div className="space-y-1.5">
            {(data?.byReason ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem perdas registradas no período.</p>
            ) : (
              data!.byReason.map((r) => {
                const max = data!.byReason[0].cost || data!.byReason[0].qty || 1;
                const val = r.cost || r.qty;
                const pct = Math.round((val / max) * 100);
                return (
                  <div key={r.reason}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize">{r.reason.replace("_", " ")}</span>
                      <span className="text-muted-foreground">
                        {r.count}× · {r.qty.toFixed(0)} und · {fmtCurrency(r.cost)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-destructive/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Top 5 itens com mais perda
          </div>
          {(data?.topItems ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">—</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {data!.topItems.map((it) => (
                  <tr key={it.sku} className="border-t border-border first:border-0">
                    <td className="py-1.5 font-mono">{it.sku}</td>
                    <td className="py-1.5 truncate max-w-[150px]">{it.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{it.qty.toFixed(0)}</td>
                    <td className="py-1.5 text-right tabular-nums text-destructive">
                      {fmtCurrency(it.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" /> Registrar perda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Item</Label>
              <Select
                value={form.itemId}
                onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {(items.data ?? []).map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.sku} · {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Custo (R$, opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.costValue}
                  onChange={(e) => setForm((f) => ({ ...f, costValue: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Select
                value={form.reason}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, reason: v as typeof f.reason }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Trash2 className="size-3 shrink-0 mt-0.5" /> Baixa automática no saldo do item via
              FEFO (lote mais próximo do vencimento).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
            >
              {mut.isPending ? "Registrando…" : "Registrar perda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
