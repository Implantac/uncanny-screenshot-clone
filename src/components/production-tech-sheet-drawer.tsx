import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { FileText, ImageIcon, Ruler, Layers, ListChecks, Shirt, Palette } from "lucide-react";

type Props = {
  productId: string | null | undefined;
  productionOrderId?: string | null;
  orderCode?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  category: string | null;
  description: string | null;
};

type Sheet = {
  id: string;
  owner_id: string;
  code: string;
  version: number;
  status: string;
};

type Material = {
  id: string;
  name: string;
  unit: string;
  consumption: number;
  notes: string | null;
  position: number;
};

type Operation = {
  id: string;
  name: string;
  machine: string | null;
  notes: string | null;
  position: number;
};

type Measurement = {
  id: string;
  point: string;
  tolerance_plus: number;
  tolerance_minus: number;
  sizes: Record<string, number>;
  position: number;
};

type GridRow = {
  variant_id: string;
  quantity: number;
  variant: {
    sku: string;
    color: { name: string; hex: string | null } | null;
    size: { label: string } | null;
  } | null;
};

/** Ficha técnica para produção — SEM valores, só receita de bolo. */
export function ProductionTechSheetDrawer({
  productId,
  productionOrderId,
  orderCode,
  open,
  onOpenChange,
}: Props) {
  const product = useQuery({
    enabled: open && !!productId,
    queryKey: ["prod-ts-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, image_url, category, description")
        .eq("id", productId as string)
        .maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });

  const sheet = useQuery({
    enabled: open && !!productId,
    queryKey: ["prod-ts-sheet", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheets")
        .select("id, owner_id, code, version, status")
        .eq("product_id", productId as string)
        .order("status", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Sheet | null;
    },
  });

  const sheetId = sheet.data?.id;

  const materials = useQuery({
    enabled: !!sheetId,
    queryKey: ["prod-ts-materials", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_materials")
        .select("id, name, unit, consumption, notes, position")
        .eq("tech_sheet_id", sheetId as string)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });

  const operations = useQuery({
    enabled: !!sheetId,
    queryKey: ["prod-ts-ops", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_operations")
        .select("id, name, machine, notes, position")
        .eq("tech_sheet_id", sheetId as string)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Operation[];
    },
  });

  const measurements = useQuery({
    enabled: !!sheetId,
    queryKey: ["prod-ts-meas", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_measurements")
        .select("id, point, tolerance_plus, tolerance_minus, sizes, position")
        .eq("tech_sheet_id", sheetId as string)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
  });

  const grid = useQuery({
    enabled: open && !!productionOrderId,
    queryKey: ["prod-ts-grid", productionOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_order_grid")
        .select(
          "variant_id, quantity, product_variants!inner(sku, product_color_options(name, hex), product_size_options(label))",
        )
        .eq("production_order_id", productionOrderId as string);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        variant_id: r.variant_id,
        quantity: r.quantity,
        variant: r.product_variants
          ? {
              sku: r.product_variants.sku,
              color: r.product_variants.product_color_options ?? null,
              size: r.product_variants.product_size_options ?? null,
            }
          : null,
      })) as GridRow[];
    },
  });

  const attachments = useQuery({
    enabled: !!sheetId,
    queryKey: ["prod-ts-attach", sheetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_attachments")
        .select("id, file_name, file_url, kind")
        .eq("tech_sheet_id", sheetId as string);
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        name: a.file_name,
        url: a.file_url,
        kind: a.kind,
      })) as { id: string; name: string; url: string; kind: string | null }[];
    },
  });

  const totalQty = (grid.data ?? []).reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Ficha para produção
            {orderCode && (
              <span className="font-mono text-xs text-muted-foreground">· {orderCode}</span>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Receita completa para corte, costura, silk e bordado — produza igual à peça piloto.
          </SheetDescription>
        </SheetHeader>

        {/* Cabeçalho do produto */}
        <div className="flex gap-3 mt-4">
          <div className="size-24 rounded-lg overflow-hidden bg-muted/40 shrink-0">
            {product.data?.image_url ? (
              <img
                src={product.data.image_url}
                alt={product.data.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full grid place-items-center text-muted-foreground">
                <ImageIcon className="size-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{product.data?.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground font-mono">
              {product.data?.sku ?? "—"}
            </div>
            {product.data?.category && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {product.data.category}
              </Badge>
            )}
            {sheet.data && (
              <div className="flex gap-1 mt-1.5">
                <Badge variant="outline" className="text-[10px]">
                  v{sheet.data.version}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${sheet.data.status === "aprovada" ? "bg-success/15 text-success border-success/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}
                >
                  {sheet.data.status}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {product.data?.description && (
          <div className="mt-3 text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 italic">
            {product.data.description}
          </div>
        )}

        {!sheet.data ? (
          <div className="mt-6 rounded-lg border border-dashed border-warning/40 bg-warning/5 p-4 text-center text-xs text-warning">
            Esta referência ainda não possui ficha técnica aprovada. Avise o desenvolvimento antes
            de produzir.
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* GRADE / QUANTIDADES */}
            {productionOrderId && (
              <Section
                icon={<Shirt className="size-4" />}
                title="Grade desta ordem"
                right={totalQty > 0 ? `${totalQty} pç` : undefined}
              >
                {grid.data && grid.data.length > 0 ? (
                  <ColorSizeGrid rows={grid.data} />
                ) : (
                  <Empty>Sem grade definida nesta OP.</Empty>
                )}
              </Section>
            )}

            {/* MATERIAIS / COMPOSIÇÃO */}
            <Section
              icon={<Layers className="size-4" />}
              title="Materiais & composição"
              right={`${materials.data?.length ?? 0} itens`}
            >
              {materials.data && materials.data.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">Material</th>
                        <th className="text-right px-2 py-1.5 font-medium">Consumo</th>
                        <th className="text-left px-2 py-1.5 font-medium">Un.</th>
                        <th className="text-left px-2 py-1.5 font-medium">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.data.map((m) => (
                        <tr key={m.id} className="border-t border-border">
                          <td className="px-2 py-1.5 font-medium">{m.name}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{m.consumption}</td>
                          <td className="px-2 py-1.5">{m.unit}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{m.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>Sem materiais cadastrados.</Empty>
              )}
            </Section>

            {/* PROCESSOS - receita de bolo */}
            <Section
              icon={<ListChecks className="size-4" />}
              title="Processos de produção"
              right={`${operations.data?.length ?? 0} passos`}
            >
              {operations.data && operations.data.length > 0 ? (
                <ol className="space-y-2">
                  {operations.data.map((op, i) => (
                    <li key={op.id} className="rounded-lg border border-border p-2.5 flex gap-3">
                      <div className="size-6 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-semibold grid place-items-center">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{op.name}</div>
                        {op.machine && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Máquina: <span className="font-mono">{op.machine}</span>
                          </div>
                        )}
                        {op.notes && (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {op.notes}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty>Sem processos cadastrados.</Empty>
              )}
            </Section>

            {/* MEDIDAS */}
            <Section
              icon={<Ruler className="size-4" />}
              title="Medidas & tolerâncias"
              right={`${measurements.data?.length ?? 0} pontos`}
            >
              {measurements.data && measurements.data.length > 0 ? (
                <MeasurementsTable items={measurements.data} />
              ) : (
                <Empty>Sem medidas cadastradas.</Empty>
              )}
            </Section>

            {/* ANEXOS - layout, silk, bordado */}
            {attachments.data && attachments.data.length > 0 && (
              <Section
                icon={<Palette className="size-4" />}
                title="Layout, silk & bordado"
                right={`${attachments.data.length} anexos`}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachments.data.map((a) => {
                    const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(a.url);
                    return (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-border overflow-hidden hover:border-primary/50 transition"
                        title={a.name}
                      >
                        {isImg ? (
                          <img
                            src={a.url}
                            alt={a.name}
                            className="w-full h-24 object-cover bg-muted"
                          />
                        ) : (
                          <div className="h-24 grid place-items-center bg-muted text-xs text-muted-foreground">
                            {a.kind ?? "Arquivo"}
                          </div>
                        )}
                        <div className="px-2 py-1 text-[10px] truncate">{a.name}</div>
                      </a>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon,
  title,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon} {title}
        </div>
        {right && <span className="text-[10px] text-muted-foreground tabular-nums">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
      {children}
    </div>
  );
}

function ColorSizeGrid({ rows }: { rows: GridRow[] }) {
  const colors = Array.from(
    new Map(
      rows.filter((r) => r.variant?.color).map((r) => [r.variant!.color!.name, r.variant!.color!]),
    ).values(),
  );
  const sizes = Array.from(
    new Set(rows.map((r) => r.variant?.size?.label).filter(Boolean)),
  ) as string[];

  if (colors.length === 0 && sizes.length === 0) {
    return (
      <ul className="text-xs space-y-1">
        {rows.map((r) => (
          <li key={r.variant_id} className="flex justify-between border-b border-border py-1">
            <span className="font-mono">{r.variant?.sku ?? r.variant_id}</span>
            <span className="tabular-nums">{r.quantity} pç</span>
          </li>
        ))}
      </ul>
    );
  }

  const cell = (color: string, size: string) =>
    rows.find((r) => r.variant?.color?.name === color && r.variant?.size?.label === size)
      ?.quantity ?? 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">Cor</th>
            {sizes.map((s) => (
              <th key={s} className="px-2 py-1.5 text-center font-medium">
                {s}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {colors.map((c) => {
            const total = sizes.reduce((sum, s) => sum + cell(c.name, s), 0);
            return (
              <tr key={c.name} className="border-t border-border">
                <td className="px-2 py-1.5 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {c.hex && (
                      <span
                        className="inline-block size-3 rounded-full border border-border"
                        style={{ background: c.hex }}
                      />
                    )}
                    {c.name}
                  </span>
                </td>
                {sizes.map((s) => (
                  <td key={s} className="px-2 py-1.5 text-center tabular-nums">
                    {cell(c.name, s) || "—"}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MeasurementsTable({ items }: { items: Measurement[] }) {
  const sizeKeys = Array.from(new Set(items.flatMap((m) => Object.keys(m.sizes ?? {}))));
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">Ponto</th>
            {sizeKeys.map((k) => (
              <th key={k} className="px-2 py-1.5 text-center font-medium">
                {k}
              </th>
            ))}
            <th className="px-2 py-1.5 text-center font-medium">Tol.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="px-2 py-1.5 font-medium">{m.point}</td>
              {sizeKeys.map((k) => (
                <td key={k} className="px-2 py-1.5 text-center tabular-nums">
                  {m.sizes?.[k] ?? "—"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums">
                +{m.tolerance_plus}/-{m.tolerance_minus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
