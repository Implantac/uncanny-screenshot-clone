import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Package, Grid3x3, Hash } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  orderId: string;
  orderCode: string;
  ownerId: string;
  fromStage: string;
  toStage: string;
  remaining: number;
};

type Mode = "qty" | "package" | "grid";
type LineType = "primeira" | "segunda_linha";

/** Passagem rápida entre setores: por Quantidade, Pacote ou Grade (variante). */
export function QuickPassButton({ orderId, orderCode, ownerId, fromStage, toStage, remaining }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("qty");
  const [qty, setQty] = useState<number>(remaining);
  const [packageId, setPackageId] = useState<string>("");
  const [gridSel, setGridSel] = useState<Record<string, number>>({});
  const [supplierId, setSupplierId] = useState<string>("");
  const [lineType, setLineType] = useState<LineType>("primeira");

  // Fornecedores ativos do owner (para select rápido)
  const suppliersQ = useQuery({
    queryKey: ["suppliers-quick", ownerId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("owner_id", ownerId)
        .order("name")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pacotes da OP (carrega só quando popover abre na aba pacote)
  const packagesQ = useQuery({
    queryKey: ["op-packages", orderId],
    enabled: open && mode === "package",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_packages")
        .select("id, code, qty, notes")
        .eq("production_order_id", orderId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Grade da OP por variante
  const gridQ = useQuery({
    queryKey: ["op-grid", orderId],
    enabled: open && mode === "grid",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_order_grid")
        .select("id, quantity, variant_id, product_variants:variant_id(sku, sizes:size_id(name), colors:color_id(name))")
        .eq("production_order_id", orderId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const baseCode = `OS-${orderCode}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

      if (mode === "package") {
        const pkg = (packagesQ.data ?? []).find((p: any) => p.id === packageId);
        if (!pkg) throw new Error("Selecione um pacote");
        const { error } = await supabase.from("service_orders").insert({
          owner_id: ownerId,
          production_order_id: orderId,
          code: baseCode,
          kind: pkg.qty < remaining ? "parcial" : "integral",
          quantity: pkg.qty,
          package_id: pkg.id,
          from_stage: fromStage,
          to_stage: toStage,
          supplier_id: supplierId || null,
          line_type: lineType,
          status: "enviada",
          sent_at: new Date().toISOString(),
        } as any);
        if (error) throw error;
        return { qty: pkg.qty, label: `pacote ${pkg.code}` };
      }

      if (mode === "grid") {
        const rows = Object.entries(gridSel).filter(([, q]) => q > 0);
        if (rows.length === 0) throw new Error("Selecione pelo menos uma grade");
        const items = rows.map(([variant_id, quantity], i) => ({
          owner_id: ownerId,
          production_order_id: orderId,
          code: `${baseCode}-${i + 1}`,
          kind: "parcial" as const,
          quantity,
          variant_id,
          from_stage: fromStage,
          to_stage: toStage,
          supplier_id: supplierId || null,
          line_type: lineType,
          status: "enviada" as const,
          sent_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("service_orders").insert(items as any);
        if (error) throw error;
        const total = rows.reduce((s, [, q]) => s + q, 0);
        return { qty: total, label: `${rows.length} grade(s)` };
      }

      // qty
      const kind = qty < remaining ? "parcial" : "integral";
      const { error } = await supabase.from("service_orders").insert({
        owner_id: ownerId,
        production_order_id: orderId,
        code: baseCode,
        kind,
        quantity: qty,
        from_stage: fromStage,
        to_stage: toStage,
        supplier_id: supplierId || null,
        line_type: lineType,
        status: "enviada",
        sent_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      return { qty, label: kind };
    },
    onSuccess: ({ qty, label }) => {
      toast.success(`Passagem criada: ${qty} pç → ${toStage} (${label}${lineType === "segunda_linha" ? " · 2ª linha" : ""})`);
      qc.invalidateQueries({ queryKey: ["pcp-kanban"] });
      qc.invalidateQueries({ queryKey: ["day-production"] });
      qc.invalidateQueries({ queryKey: ["outsourced-wip"] });
      setOpen(false);
      setGridSel({});
      setPackageId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={`Passagem rápida → ${toStage}`}
        className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/60 hover:bg-primary hover:text-primary-foreground transition"
      >
        <Send className="size-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border border-border bg-popover shadow-lg p-3 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-semibold">Passagem rápida</div>
            <div className="text-[10px] text-muted-foreground">
              {orderCode} · {fromStage} → <strong>{toStage}</strong>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="w-full grid grid-cols-3 h-8">
                <TabsTrigger value="qty" className="text-[10px] gap-1"><Hash className="size-3" />Qtd</TabsTrigger>
                <TabsTrigger value="package" className="text-[10px] gap-1"><Package className="size-3" />Pacote</TabsTrigger>
                <TabsTrigger value="grid" className="text-[10px] gap-1"><Grid3x3 className="size-3" />Grade</TabsTrigger>
              </TabsList>

              <TabsContent value="qty" className="space-y-2">
                <div className="flex gap-1">
                  {[
                    { label: "1/4", v: Math.max(1, Math.floor(remaining / 4)) },
                    { label: "Metade", v: Math.max(1, Math.floor(remaining / 2)) },
                    { label: "Tudo", v: remaining },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setQty(p.v)}
                      className={`flex-1 text-[10px] py-1 rounded border transition ${
                        qty === p.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {p.label} ({p.v})
                    </button>
                  ))}
                </div>
                <label className="block text-[10px] text-muted-foreground">
                  Quantidade ({remaining} restantes)
                  <input
                    type="number"
                    min={1}
                    max={remaining}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(remaining, Number(e.target.value) || 0)))}
                    className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1"
                  />
                </label>
              </TabsContent>

              <TabsContent value="package" className="space-y-1.5">
                {packagesQ.isLoading && <div className="text-[10px] text-muted-foreground">Carregando pacotes…</div>}
                {!packagesQ.isLoading && (packagesQ.data?.length ?? 0) === 0 && (
                  <div className="text-[10px] text-muted-foreground py-2">Nenhum pacote registrado nesta OP.</div>
                )}
                <div className="max-h-40 overflow-auto space-y-1">
                  {packagesQ.data?.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPackageId(p.id)}
                      className={`w-full text-left text-[11px] px-2 py-1.5 rounded border transition ${
                        packageId === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.code}</span>
                        <span className="font-mono text-muted-foreground">{p.qty} pç</span>
                      </div>
                      {p.notes && <div className="text-[9px] text-muted-foreground truncate">{p.notes}</div>}
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="grid" className="space-y-1.5">
                {gridQ.isLoading && <div className="text-[10px] text-muted-foreground">Carregando grade…</div>}
                {!gridQ.isLoading && (gridQ.data?.length ?? 0) === 0 && (
                  <div className="text-[10px] text-muted-foreground py-2">Sem grade cadastrada nesta OP.</div>
                )}
                <div className="max-h-40 overflow-auto space-y-1">
                  {gridQ.data?.map((g: any) => {
                    const v = g.product_variants;
                    const label = [v?.sizes?.name, v?.colors?.name].filter(Boolean).join(" · ") || v?.sku || "—";
                    const sel = gridSel[g.variant_id] ?? 0;
                    return (
                      <div key={g.id} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{label}</div>
                          <div className="text-[9px] text-muted-foreground font-mono">disp: {g.quantity}</div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={g.quantity}
                          value={sel}
                          onChange={(e) => setGridSel((s) => ({
                            ...s,
                            [g.variant_id]: Math.max(0, Math.min(g.quantity, Number(e.target.value) || 0)),
                          }))}
                          className="w-16 text-xs bg-background border border-border rounded px-1.5 py-0.5"
                        />
                      </div>
                    );
                  })}
                </div>
                {Object.values(gridSel).some((q) => q > 0) && (
                  <div className="text-[10px] text-muted-foreground text-right">
                    Total: <strong>{Object.values(gridSel).reduce((s, q) => s + q, 0)}</strong> pç
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <label className="block text-[10px] text-muted-foreground">
              Fornecedor (opcional)
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full mt-0.5 text-xs bg-background border border-border rounded px-2 py-1"
              >
                <option value="">— Interno —</option>
                {suppliersQ.data?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Linha da peça</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setLineType("primeira")}
                  className={`text-[10px] px-2 py-1.5 rounded border transition ${lineType === "primeira" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                >
                  1ª linha
                </button>
                <button
                  type="button"
                  onClick={() => setLineType("segunda_linha")}
                  className={`text-[10px] px-2 py-1.5 rounded border transition ${lineType === "segunda_linha" ? "border-orange-500/40 bg-orange-500/10 text-orange-500" : "border-border hover:bg-muted"}`}
                >
                  2ª linha
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending}
                className="flex-1 text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {create.isPending ? "Enviando…" : "Enviar passagem"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1.5 rounded border border-border hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
