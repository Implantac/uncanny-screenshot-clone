import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBOMExplosion } from "@/lib/bom-explosion.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Boxes, AlertTriangle, CheckCircle2, ShoppingCart } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  productionOrderId: string;
  orderCode: string;
  trigger?: React.ReactNode;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function BomExplosionDialog({ productionOrderId, orderCode, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const fetchFn = useServerFn(getBOMExplosion);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bom-explosion", productionOrderId],
    queryFn: () => fetchFn({ data: { productionOrderId } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-md hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground"
            title="BOM – Explosão de matéria-prima por grade"
          >
            <Boxes className="size-3.5" />
            BOM
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="size-5 text-primary" />
            BOM · OP {orderCode}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Calculando explosão de matéria-prima...</div>
        )}
        {error && (
          <div className="text-sm text-destructive py-4">Erro: {(error as Error).message}</div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              {data.product_name ?? "—"} · Grade total: <strong>{fmt(data.order.quantity)}</strong> peças
              {data.tech_sheet_status && (
                <Badge variant="outline" className="ml-2">ficha {data.tech_sheet_status}</Badge>
              )}
            </div>

            {data.reason && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
                {data.reason}
              </div>
            )}

            {data.lines.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Custo total estimado" value={fmtMoney(data.totals.necessidade_total)} />
                  <Stat
                    label="Itens em falta"
                    value={String(data.totals.itens_em_falta)}
                    tone={data.totals.itens_em_falta > 0 ? "danger" : "ok"}
                  />
                  <Stat
                    label="Gap acumulado"
                    value={fmt(Math.abs(data.totals.gap_total))}
                    tone={data.totals.gap_total < 0 ? "danger" : "ok"}
                  />
                </div>

                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-2">Material</th>
                        <th className="p-2 text-right">Cons./peça</th>
                        <th className="p-2 text-right">Perda</th>
                        <th className="p-2 text-right">Necessidade</th>
                        <th className="p-2 text-right">Saldo</th>
                        <th className="p-2 text-right">Gap</th>
                        <th className="p-2">Status</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{l.material_name}</div>
                            {l.inventory_item_name && (
                              <div className="text-[10px] text-muted-foreground">{l.inventory_item_name}</div>
                            )}
                          </td>
                          <td className="p-2 text-right tabular-nums">{fmt(l.consumption_unit)} {l.unit ?? ""}</td>
                          <td className="p-2 text-right tabular-nums">{fmt(l.loss_pct)}%</td>
                          <td className="p-2 text-right tabular-nums font-medium">{fmt(l.necessidade)}</td>
                          <td className="p-2 text-right tabular-nums">{l.saldo !== null ? fmt(l.saldo) : "—"}</td>
                          <td className={`p-2 text-right tabular-nums ${l.gap !== null && l.gap < 0 ? "text-destructive font-semibold" : ""}`}>
                            {l.gap !== null ? fmt(l.gap) : "—"}
                          </td>
                          <td className="p-2"><StatusBadge status={l.status} /></td>
                          <td className="p-2">
                            {l.status === "falta" && (
                              <Link
                                to="/pedidos-compra"
                                className="text-[10px] inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <ShoppingCart className="size-3" /> comprar
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className={`rounded-md border p-2.5 ${tone === "danger" ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "atencao" | "falta" | "sem-saldo" }) {
  if (status === "ok") return <Badge variant="outline" className="text-emerald-600 border-emerald-600/40"><CheckCircle2 className="size-3 mr-1" />ok</Badge>;
  if (status === "atencao") return <Badge variant="outline" className="text-amber-600 border-amber-600/40">atenção</Badge>;
  if (status === "falta") return <Badge variant="destructive"><AlertTriangle className="size-3 mr-1" />falta</Badge>;
  return <Badge variant="outline">sem saldo</Badge>;
}
