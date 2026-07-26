import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Palette, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BaseProduct = {
  id: string;
  owner_id: string;
  sku: string;
  name: string;
  colors: string[] | null;
};

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function cloneProduct(
  baseId: string,
  overrides: { sku: string; name: string; colors?: string[]; ownerId: string },
  opts: { includeTechSheet: boolean; includeSizes: boolean },
) {
  // 1. carregar produto base
  const { data: base, error: e1 } = await supabase
    .from("products")
    .select("*")
    .eq("id", baseId)
    .single();
  if (e1 || !base) throw new Error(e1?.message ?? "Produto base não encontrado");

  // 2. inserir novo produto (remove id/created_at/updated_at)
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    abc_class: _a,
    abc_revenue_12m: _r,
    abc_updated_at: _au,
    ...rest
  } = base as Record<string, unknown> & { id: string };
  void _id;
  void _c;
  void _u;
  void _a;
  void _r;
  void _au;
  const payload = {
    ...rest,
    owner_id: overrides.ownerId,
    sku: overrides.sku,
    name: overrides.name,
    colors: overrides.colors ?? base.colors ?? [],
    status: "rascunho" as const,
  };
  const { data: created, error: e2 } = await supabase
    .from("products")
    .insert(payload)
    .select("id")
    .single();
  if (e2 || !created) throw new Error(e2?.message ?? "Falha ao criar produto");

  const newId = created.id as string;

  // 3. tamanhos ativos
  if (opts.includeSizes) {
    const { data: sizes } = await supabase
      .from("product_size_options")
      .select("label, position, active")
      .eq("product_id", baseId);
    if (sizes && sizes.length > 0) {
      await supabase.from("product_size_options").insert(
        sizes.map((s) => ({
          label: s.label,
          position: s.position,
          active: s.active,
          product_id: newId,
          owner_id: overrides.ownerId,
        })),
      );
    }
  }

  // 4. ficha técnica (última) + materiais + medidas + operações
  if (opts.includeTechSheet) {
    const { data: sheet } = await supabase
      .from("tech_sheets")
      .select("*")
      .eq("product_id", baseId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sheet) {
      const {
        id: sid,
        created_at: sc,
        updated_at: su,
        approved_at: sa,
        approved_by: sb,
        approval_note: san,
        ...sheetRest
      } = sheet as Record<string, unknown> & { id: string };
      void sid;
      void sc;
      void su;
      void sa;
      void sb;
      void san;
      const { data: newSheet, error: eSheet } = await supabase
        .from("tech_sheets")
        .insert({
          ...sheetRest,
          product_id: newId,
          owner_id: overrides.ownerId,
          status: "rascunho" as const,
          code: `${(sheetRest as { code?: string }).code ?? "FT"}-${slug(overrides.sku).slice(-6)}`,
        })
        .select("id")
        .single();
      if (!eSheet && newSheet) {
        const nsId = newSheet.id as string;
        const [{ data: mats }, { data: meas }, { data: ops }] = await Promise.all([
          supabase.from("tech_sheet_materials").select("*").eq("tech_sheet_id", sheet.id),
          supabase.from("tech_sheet_measurements").select("*").eq("tech_sheet_id", sheet.id),
          supabase.from("tech_sheet_operations").select("*").eq("tech_sheet_id", sheet.id),
        ]);
        const strip = <T extends Record<string, unknown>>(rows: T[] | null) =>
          (rows ?? []).map((r) => {
            const { id, created_at, updated_at, ...rest } = r as T & {
              id?: string;
              created_at?: string;
              updated_at?: string;
            };
            void id;
            void created_at;
            void updated_at;
            return { ...rest, tech_sheet_id: nsId, owner_id: overrides.ownerId };
          });
        if (mats?.length) await supabase.from("tech_sheet_materials").insert(strip(mats));
        if (meas?.length) await supabase.from("tech_sheet_measurements").insert(strip(meas));
        if (ops?.length) await supabase.from("tech_sheet_operations").insert(strip(ops));
      }
    }
  }

  return newId;
}

export function ProductDuplicateDialog({
  open,
  onOpenChange,
  product,
  ownerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: BaseProduct;
  ownerId: string;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"single" | "colors">("single");
  const [includeTechSheet, setIncludeTechSheet] = useState(true);
  const [includeSizes, setIncludeSizes] = useState(true);

  // single
  const [newSku, setNewSku] = useState(`${product.sku}-COPY`);
  const [newName, setNewName] = useState(`${product.name} (cópia)`);

  // colors
  const [colorsText, setColorsText] = useState("");

  const singleMut = useMutation({
    mutationFn: async () => {
      return cloneProduct(
        product.id,
        { sku: newSku.trim(), name: newName.trim(), ownerId },
        { includeTechSheet, includeSizes },
      );
    },
    onSuccess: () => {
      toast.success("Produto duplicado");
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao duplicar"),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const colors = colorsText
        .split(/[,;\n]/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (!colors.length) throw new Error("Informe ao menos uma cor");
      let ok = 0;
      const errors: string[] = [];
      for (const color of colors) {
        try {
          await cloneProduct(
            product.id,
            {
              sku: `${product.sku}-${slug(color).toUpperCase()}`,
              name: `${product.name} · ${color}`,
              colors: [color],
              ownerId,
            },
            { includeTechSheet, includeSizes },
          );
          ok += 1;
        } catch (err) {
          errors.push(`${color}: ${(err as Error).message}`);
        }
      }
      return { ok, errors };
    },
    onSuccess: ({ ok, errors }) => {
      if (ok > 0) toast.success(`${ok} variante(s) criada(s)`);
      if (errors.length) toast.error(errors.slice(0, 3).join(" · "));
      qc.invalidateQueries({ queryKey: ["products"] });
      if (errors.length === 0) onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = singleMut.isPending || bulkMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar produto</DialogTitle>
          <DialogDescription>
            A partir de <strong>{product.name}</strong> ({product.sku}).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "colors")}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <Copy className="size-4" /> Cópia única
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-2">
              <Palette className="size-4" /> Variações de cor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-3 pt-3">
            <div>
              <Label>SKU</Label>
              <Input value={newSku} onChange={(e) => setNewSku(e.target.value)} />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-3 pt-3">
            <div>
              <Label>Cores (uma por linha, ou separadas por vírgula)</Label>
              <Textarea
                rows={4}
                placeholder={"Preto\nBranco\nVermelho"}
                value={colorsText}
                onChange={(e) => setColorsText(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                SKU gerado: <code>{product.sku}-{"{COR}"}</code>. Nome: {product.name} · {"{cor}"}.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 rounded-lg border border-border/60 p-3 mt-1">
          <div className="text-xs font-semibold">O que copiar</div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeTechSheet}
              onCheckedChange={(v) => setIncludeTechSheet(!!v)}
            />
            Ficha técnica + BOM + medidas + operações (como rascunho)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeSizes} onCheckedChange={(v) => setIncludeSizes(!!v)} />
            Grade de tamanhos
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={() => (tab === "single" ? singleMut.mutate() : bulkMut.mutate())}
            disabled={pending}
            className="gap-2"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {tab === "single" ? "Duplicar" : "Criar variantes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
