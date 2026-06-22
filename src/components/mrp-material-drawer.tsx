import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShoppingCart, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getMaterialDetail,
  generatePurchaseSuggestion,
  saveMaterialMrpOverrides,
} from "@/lib/mrp-material.functions";
import type { MrpRow } from "@/lib/mrp-planning.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const STATUS_CLASS: Record<string, string> = {
  critico: "bg-destructive/10 text-destructive border-destructive/30",
  atencao: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  normal: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  excesso: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};
const num = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function MrpMaterialDrawer({
  row,
  onClose,
}: {
  row: MrpRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getMaterialDetail);
  const buyFn = useServerFn(generatePurchaseSuggestion);
  const overrideFn = useServerFn(saveMaterialMrpOverrides);
  const [qty, setQty] = useState<number>(row?.suggestedPurchase ?? 0);
  const [sl, setSl] = useState<string>(String(row?.serviceLevel ?? 95));
  const [lt, setLt] = useState<string>(String(row?.leadTimeDays ?? 14));

  const { data, isLoading } = useQuery({
    queryKey: ["mrp", "detail", row?.id],
    queryFn: () => detailFn({ data: { inventoryItemId: row!.id } }),
    enabled: !!row,
  });

  // sincroniza qty quando row muda
  useMemo(() => {
    if (row) setQty(row.suggestedPurchase || row.eoq || 0);
  }, [row]);

  const buy = useMutation({
    mutationFn: (v: { quantity: number; supplierId?: string }) =>
      buyFn({ data: { inventoryItemId: row!.id, ...v } }),
    onSuccess: (r) => {
      toast.success(`Solicitação ${r.code} criada`);
      qc.invalidateQueries({ queryKey: ["mrp"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!row) return null;

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg">{row.name}</SheetTitle>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {row.sku} · {row.unit} · {row.deposit ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fornecedor: {row.supplierName ?? "—"} · LT {row.leadTimeDays}d
              </p>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_CLASS[row.status]} uppercase tracking-wide font-medium h-fit`}
            >
              {row.status}
            </span>
          </div>
        </SheetHeader>

        {/* Sugestão de compra */}
        {row.suggestedPurchase > 0 && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <ShoppingCart className="size-4 text-primary" /> Sugestão automática de compra
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <Stat label="Saldo" value={`${num(row.balance)} ${row.unit}`} />
              <Stat label="Em pedido" value={`${num(row.onOrder)} ${row.unit}`} />
              <Stat label="Máximo" value={`${num(row.maximum)} ${row.unit}`} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Quantidade a comprar</Label>
                <Input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  min={1}
                />
              </div>
              <Button
                onClick={() => buy.mutate({ quantity: qty })}
                disabled={buy.isPending || qty <= 0}
                className="gap-2"
              >
                {buy.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                Gerar solicitação
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Cria PO em rascunho com fornecedor preferencial e entrega prevista (hoje + {row.leadTimeDays}d).
              Valor estimado: {brl(row.suggestedValue)}.
            </p>
          </div>
        )}

        <Tabs defaultValue="planejamento" className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
            <TabsTrigger value="consumo">Consumo</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="producao">Produção</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="planejamento" className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Consumo diário" value={`${num(row.dailyConsumption, 1)} ${row.unit}/d`} />
              <Stat label="Demanda mensal" value={`${num(row.monthlyDemand)} ${row.unit}`} />
              <Stat label="Demanda anual" value={`${num(row.annualDemand)} ${row.unit}`} />
              <Stat label="Desvio padrão (σ)" value={num(row.stdDev, 1)} />
              <Stat label="Nível de serviço" value={`${row.serviceLevel}% (Z=${row.z})`} />
              <Stat label="Lead time" value={`${row.leadTimeDays}d`} />
              <Stat label="Estoque segurança" value={`${num(row.safetyStock)} ${row.unit}`} />
              <Stat label="Ponto de pedido" value={`${num(row.reorderPoint)} ${row.unit}`} highlight />
              <Stat label="Estoque mínimo" value={`${num(row.minimum)} ${row.unit}`} />
              <Stat label="LEC" value={`${num(row.eoq)} ${row.unit}`} />
              <Stat label="Estoque máximo" value={`${num(row.maximum)} ${row.unit}`} />
              <Stat label="Cobertura" value={row.coverageDays !== null ? `${row.coverageDays}d` : "—"} />
              <Stat label="Capital empatado" value={brl(row.capitalEmpatado)} />
              <Stat label="Giro estoque" value={`${row.turnover.toFixed(1)}×`} />
            </div>
          </TabsContent>

          <TabsContent value="consumo" className="mt-4">
            {isLoading || !data ? (
              <Skeleton />
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                  <Stat label="30 dias" value={num(data.consumption.days30)} />
                  <Stat label="90 dias" value={num(data.consumption.days90)} />
                  <Stat label="180 dias" value={num(data.consumption.days180)} />
                  <Stat label="365 dias" value={num(data.consumption.days365)} />
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.consumption.series}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="qty"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Saídas diárias dos últimos 30 dias.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="pedidos" className="mt-4">
            {isLoading || !data ? (
              <Skeleton />
            ) : data.openPurchaseOrders.length === 0 ? (
              <Empty text="Sem pedidos de compra em aberto." />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {data.openPurchaseOrders.map((p) => (
                  <li key={p.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-mono text-xs">{p.code}</div>
                      <div className="text-muted-foreground text-xs">
                        {p.supplier ?? "—"} · {p.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums">{num(p.quantity)} {row.unit}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.expectedDate ?? "sem data"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="producao" className="mt-4">
            {isLoading || !data ? (
              <Skeleton />
            ) : data.productionDemand.length === 0 ? (
              <Empty text="Nenhuma OP ativa consome este material." />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {data.productionDemand.map((o, idx) => (
                  <li key={idx} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-mono text-xs">{o.opCode}</div>
                      <div className="text-muted-foreground text-xs">
                        {o.productName ?? "—"} · {o.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums">
                        {num(o.matRequired)} {row.unit}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.dueDate ?? "sem prazo"} · OP {num(o.opQuantity)}pc
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            {isLoading || !data ? (
              <Skeleton />
            ) : data.timeline.length === 0 ? (
              <Empty text="Sem movimentações recentes." />
            ) : (
              <ol className="space-y-2 text-sm">
                {data.timeline.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="text-xs text-muted-foreground tabular-nums w-24 shrink-0">
                      {new Date(t.at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="flex-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded mr-2 ${
                          t.kind === "entrada"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : t.kind === "saida"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.kind}
                      </span>
                      {t.text}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"} px-3 py-2`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
function Skeleton() {
  return (
    <div className="h-32 flex items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

// usado para evitar tree-shake dos ícones importados acima
void Activity;
void AlertTriangle;
