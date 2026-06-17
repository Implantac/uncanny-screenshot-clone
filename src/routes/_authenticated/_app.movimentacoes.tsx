import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Plus, ArrowDownToLine, ArrowUpFromLine, Settings2, Factory, Search, X, ArrowRight } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const searchSchema = z.object({
  tab: fallback(z.enum(["passagem", "estoque"]), "passagem").default("passagem"),
  op: fallback(z.string(), "").default(""),
  lote: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/_app/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações · USE MODA OS" }] }),
  validateSearch: zodValidator(searchSchema),
  component: MovimentacoesPage,
});

type Mov = {
  id: string; owner_id: string; inventory_item_id: string;
  type: "entrada" | "saida" | "ajuste" | "transferencia";
  quantity: number; reference_kind: string | null; reference_id: string | null;
  notes: string | null; created_at: string;
};
type Item = { id: string; sku: string; name: string; unit: string; balance: number };

const STAGE_LABEL: Record<string, string> = {
  cad: "CAD", modelagem: "Modelagem", corte: "Corte", silk: "Silk",
  costura: "Costura", acabamento: "Acabamento", qualidade: "Qualidade",
  expedicao: "Expedição", entregue: "Entregue", concluido: "Concluído",
};

function MovimentacoesPage() {
  const { user } = useAuth();
  const { tab, op, lote } = Route.useSearch();
  const navigate = useNavigate({ from: "/movimentacoes" });
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-primary" /> Movimentações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passagem entre setores (1ª linha) e estoque — entradas e saídas atualizadas em tempo real.
          </p>
        </div>
        {tab === "estoque" && (
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> Nova movimentação</Button>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: (prev: any) => ({ ...prev, tab: v as "passagem" | "estoque" }) })}
      >
        <TabsList>
          <TabsTrigger value="passagem" className="gap-1.5"><Factory className="size-3.5" /> Passagem entre setores</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-1.5"><ArrowLeftRight className="size-3.5" /> Estoque</TabsTrigger>
        </TabsList>

        <TabsContent value="passagem" className="mt-4">
          <PassagemPanel op={op} lote={lote} onFilter={(p) => navigate({ search: (prev: any) => ({ ...prev, ...p }) })} />
        </TabsContent>

        <TabsContent value="estoque" className="mt-4">
          <EstoquePanel userId={user?.id} open={open} setOpen={setOpen} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ===================== PASSAGEM ENTRE SETORES (1ª LINHA) ===================== */

function PassagemPanel({
  op, lote, onFilter,
}: { op: string; lote: string; onFilter: (p: { op?: string; lote?: string }) => void }) {
  useRealtime("production_stage_log", ["stage_log"]);
  useRealtime("service_orders", ["service_orders"]);

  const { data: orders = [] } = useQuery({
    queryKey: ["passagem-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("id, code, batch_code, quantity, stage, product_id, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredOrders = useMemo(() => {
    const opU = op.trim().toUpperCase();
    const loteU = lote.trim().toUpperCase();
    return orders.filter((o) => {
      if (loteU && (o.batch_code ?? "").toUpperCase() !== loteU) return false;
      if (opU && !(o.code ?? "").toUpperCase().includes(opU)
              && !(o.products?.sku ?? "").toUpperCase().includes(opU)) return false;
      return true;
    });
  }, [orders, op, lote]);

  const orderIds = filteredOrders.map((o) => o.id);

  const { data: logs = [], isLoading } = useQuery({
    enabled: orderIds.length > 0,
    queryKey: ["stage_log", orderIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_stage_log")
        .select("id, order_id, from_stage, to_stage, quantity, is_partial, note, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data as any[];
    },
  });

  const orderMap = new Map(filteredOrders.map((o) => [o.id, o]));

  // Agregado por OP × etapa destino (entrada/saída acumuladas)
  const aggregate = useMemo(() => {
    const m = new Map<string, { order: any; perStage: Map<string, { entrada: number; saida: number; last: string }> }>();
    for (const o of filteredOrders) {
      m.set(o.id, { order: o, perStage: new Map() });
    }
    for (const l of logs) {
      const row = m.get(l.order_id);
      if (!row) continue;
      // saída do from_stage
      if (l.from_stage) {
        const cur = row.perStage.get(l.from_stage) ?? { entrada: 0, saida: 0, last: l.created_at };
        cur.saida += Number(l.quantity || 0);
        if (l.created_at > cur.last) cur.last = l.created_at;
        row.perStage.set(l.from_stage, cur);
      }
      // entrada no to_stage
      const dst = row.perStage.get(l.to_stage) ?? { entrada: 0, saida: 0, last: l.created_at };
      dst.entrada += Number(l.quantity || 0);
      if (l.created_at > dst.last) dst.last = l.created_at;
      row.perStage.set(l.to_stage, dst);
    }
    return Array.from(m.values()).filter((r) => r.perStage.size > 0 || op || lote);
  }, [filteredOrders, logs, op, lote]);

  const totals = useMemo(() => {
    const entr = logs.reduce((s, l) => s + Number(l.quantity || 0), 0);
    return { passes: logs.length, pecas: entr, parciais: logs.filter((l) => l.is_partial).length };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">Lote</Label>
          <Input
            placeholder="ex: 656"
            value={lote}
            onChange={(e) => onFilter({ lote: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">OP ou referência (SKU)</Label>
          <div className="relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ex: OP-20250617 ou CM704"
              value={op}
              onChange={(e) => onFilter({ op: e.target.value })}
              className="h-8 pl-7"
            />
          </div>
        </div>
        {(op || lote) && (
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => onFilter({ op: "", lote: "" })}>
            <X className="size-3.5" /> Limpar
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {totals.passes} passagens · {totals.pecas.toFixed(0)} pç{totals.parciais > 0 ? ` · ${totals.parciais} parciais` : ""}
        </div>
      </div>

      {orderIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          Nenhuma OP encontrada com esses filtros.
        </div>
      ) : (
        <>
          {/* Saldo por OP × setor */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
              Saldo por OP e setor (entradas / saídas)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 sticky left-0 bg-muted/20">OP / Referência</th>
                    <th className="text-right px-3 py-2">Total</th>
                    {Object.entries(STAGE_LABEL).map(([k, lbl]) => (
                      <th key={k} className="text-right px-3 py-2 whitespace-nowrap">{lbl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aggregate.map(({ order, perStage }) => (
                    <tr key={order.id} className="border-t border-border">
                      <td className="px-3 py-2 sticky left-0 bg-card">
                        <div className="font-mono text-xs">{order.code}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {order.products?.sku ? `${order.products.sku} · ` : ""}{order.products?.name ?? "—"}
                          {order.batch_code ? ` · lote ${order.batch_code}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{order.quantity}</td>
                      {Object.keys(STAGE_LABEL).map((k) => {
                        const v = perStage.get(k);
                        if (!v) return <td key={k} className="px-3 py-2 text-right text-muted-foreground/40">·</td>;
                        const saldo = v.entrada - v.saida;
                        return (
                          <td key={k} className="px-3 py-2 text-right tabular-nums">
                            <div className="text-[11px] inline-flex items-center gap-1">
                              <span className="text-emerald-500">↓{v.entrada.toFixed(0)}</span>
                              <span className="text-destructive">↑{v.saida.toFixed(0)}</span>
                            </div>
                            <div className={`text-[10px] ${saldo > 0 ? "text-emerald-500" : saldo < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {saldo > 0 ? `+${saldo.toFixed(0)} no setor` : saldo < 0 ? `${saldo.toFixed(0)}` : "0"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timeline das passagens */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
              Histórico de passagens (mais recentes)
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Quando</th>
                  <th className="text-left px-3 py-2">OP</th>
                  <th className="text-left px-3 py-2">Passagem</th>
                  <th className="text-right px-3 py-2">Qtd</th>
                  <th className="text-left px-3 py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem passagens registradas para os filtros atuais.</td></tr>
                ) : logs.map((l) => {
                  const o = orderMap.get(l.order_id);
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-mono">{o?.code ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{o?.products?.name ?? ""}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          {l.from_stage && (
                            <>
                              <span className="text-muted-foreground">{STAGE_LABEL[l.from_stage] ?? l.from_stage}</span>
                              <ArrowRight className="size-3 text-muted-foreground" />
                            </>
                          )}
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                            {STAGE_LABEL[l.to_stage] ?? l.to_stage}
                          </Badge>
                          {l.is_partial && (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">parcial</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{Number(l.quantity || 0).toFixed(0)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-xs italic">{l.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ===================== ESTOQUE (mantém comportamento atual) ===================== */

function EstoquePanel({ userId, open, setOpen }: { userId?: string; open: boolean; setOpen: (v: boolean) => void }) {
  useRealtime("stock_movements", ["stock_movements"]);

  const { data: moves = [], isLoading } = useQuery({
    queryKey: ["stock_movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Mov[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["inventory_items_slim"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("id, sku, name, unit, balance").order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground text-xs">
          <tr>
            <th className="text-left px-3 py-2">Data</th>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-left px-3 py-2">Item</th>
            <th className="text-right px-3 py-2">Quantidade</th>
            <th className="text-left px-3 py-2">Origem</th>
            <th className="text-left px-3 py-2">Notas</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>
          ) : moves.length === 0 ? (
            <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>
          ) : moves.map((m) => {
            const it = itemMap.get(m.inventory_item_id);
            return (
              <tr key={m.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">{typeBadge(m.type)}</td>
                <td className="px-3 py-2">{it ? <><span className="font-mono text-xs">{it.sku}</span> · {it.name}</> : <span className="text-muted-foreground">—</span>}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.type === "entrada" ? "text-emerald-400" : m.type === "saida" ? "text-destructive" : ""}`}>
                  {m.type === "entrada" ? "+" : m.type === "saida" ? "−" : ""}{Number(m.quantity).toFixed(0)} {it?.unit ?? ""}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.reference_kind ?? "manual"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-xs">{m.notes ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <MovDialog open={open} onOpenChange={setOpen} items={items} userId={userId} />
    </div>
  );
}

function typeBadge(t: Mov["type"]) {
  const cfg: Record<string, { label: string; cls: string; Icon: typeof Plus }> = {
    entrada: { label: "Entrada", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", Icon: ArrowDownToLine },
    saida: { label: "Saída", cls: "bg-destructive/20 text-destructive border-destructive/30", Icon: ArrowUpFromLine },
    ajuste: { label: "Ajuste", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", Icon: Settings2 },
    transferencia: { label: "Transferência", cls: "bg-sky-500/20 text-sky-400 border-sky-500/30", Icon: ArrowLeftRight },
  };
  const c = cfg[t];
  const Ic = c.Icon;
  return <Badge variant="outline" className={`${c.cls} gap-1`}><Ic className="size-3" /> {c.label}</Badge>;
}

function MovDialog({ open, onOpenChange, items, userId }: { open: boolean; onOpenChange: (v: boolean) => void; items: Item[]; userId?: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<Mov["type"]>("entrada");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");
  const [supplierLot, setSupplierLot] = useState("");
  const [supplierColor, setSupplierColor] = useState("");

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      if (!itemId) throw new Error("Selecione um item");
      if (quantity <= 0 && type !== "ajuste") throw new Error("Quantidade deve ser maior que zero");
      const { error } = await supabase.from("stock_movements").insert({
        owner_id: userId, inventory_item_id: itemId, type, quantity, notes: notes || null,
        supplier_lot: supplierLot || null,
        supplier_color: supplierColor || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["inventory_items_slim"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory_lot_breakdown"] });
      toast.success("Movimentação registrada");
      onOpenChange(false);
      setItemId(""); setQuantity(0); setNotes(""); setType("entrada");
      setSupplierLot(""); setSupplierColor("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = items.find((i) => i.id === itemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>O saldo do item será atualizado automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as Mov["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="ajuste">Ajuste (saldo absoluto)</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.sku} · {i.name} (saldo: {Number(i.balance).toFixed(0)} {i.unit})</SelectItem>)}
              </SelectContent>
            </Select>
            {selected && <p className="text-xs text-muted-foreground">Saldo atual: {Number(selected.balance).toFixed(0)} {selected.unit}</p>}
          </div>
          <div className="space-y-2">
            <Label>{type === "ajuste" ? "Novo saldo absoluto" : "Quantidade"}</Label>
            <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
          </div>
          <div className="space-y-2"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
