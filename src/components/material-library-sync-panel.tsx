import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Loader2,
  Layers,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type MaterialUsage = {
  material_id: string;
  material_name: string;
  material_code: string;
  material_kind: string;
  reference_cost: number | null;
  color_hex: string | null;
  usages: Array<{
    tech_sheet_id: string;
    tech_sheet_code: string;
    tech_sheet_status: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    bom_unit_cost: number;
    bom_consumption: number;
    bom_total: number;
    cost_divergent: boolean;
  }>;
};

type Props = {
  materialId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * MaterialLibrarySyncPanel — Modal que mostra onde um material
 * da Biblioteca Global está sendo usado (em quais Fichas Técnicas),
 * com indicação de divergência de custo e ação de sincronização.
 */
export function MaterialLibrarySyncPanel({
  materialId,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();

  const { data: usage, isLoading } = useQuery({
    enabled: open && !!materialId,
    queryKey: ["material-library-usage", materialId],
    queryFn: async () => {
      // 1. Get material info
      const { data: mat, error: matErr } = await supabase
        .from("material_library")
        .select("id, name, code, kind, reference_cost, color_hex")
        .eq("id", materialId)
        .single();
      if (matErr) throw matErr;

      // 2. Get all tech sheet materials linked to this library item
      const { data: bomItems, error: bomErr } = await supabase
        .from("tech_sheet_materials")
        .select("id, name, unit_cost, consumption, total_cost, tech_sheet_id")
        .eq("material_id", materialId);
      if (bomErr) throw bomErr;

      // 3. Get tech sheets info
      const sheetIds = [...new Set(bomItems.map((b) => b.tech_sheet_id))];
      const { data: sheets, error: sheetErr } = sheetIds.length
        ? await supabase
            .from("tech_sheets")
            .select("id, code, status, product_id")
            .in("id", sheetIds)
        : { data: [], error: null };
      if (sheetErr) throw sheetErr;

      // 4. Get product info
      const productIds = [
        ...new Set((sheets ?? []).map((s) => s.product_id).filter(Boolean)),
      ] as string[];
      const { data: products, error: prodErr } = productIds.length
        ? await supabase
            .from("products")
            .select("id, name, sku")
            .in("id", productIds)
        : { data: [], error: null };
      if (prodErr) throw prodErr;

      const prodMap = new Map(
        (products ?? []).map((p: { id: string; name: string; sku: string }) => [p.id, p]),
      );

      const usages = (sheets ?? []).map((sheet) => {
        const bomItem = bomItems.find((b) => b.tech_sheet_id === sheet.id);
        const product = sheet.product_id
          ? prodMap.get(sheet.product_id)
          : null;
        const refCost = Number(mat.reference_cost ?? 0);
        const bomCost = Number(bomItem?.unit_cost ?? 0);
        return {
          tech_sheet_id: sheet.id,
          tech_sheet_code: sheet.code,
          tech_sheet_status: sheet.status,
          product_id: sheet.product_id ?? "",
          product_name: product?.name ?? "Produto não vinculado",
          product_sku: product?.sku ?? "—",
          bom_unit_cost: bomCost,
          bom_consumption: Number(bomItem?.consumption ?? 0),
          bom_total: Number(bomItem?.total_cost ?? 0),
          cost_divergent: refCost > 0 && Math.abs(bomCost - refCost) / refCost > 0.05,
        };
      });

      const result: MaterialUsage = {
        material_id: mat.id,
        material_name: mat.name,
        material_code: mat.code,
        material_kind: mat.kind,
        reference_cost: mat.reference_cost,
        color_hex: mat.color_hex,
        usages,
      };
      return result;
    },
  });

  const syncCosts = useMutation({
    mutationFn: async () => {
      if (!usage?.reference_cost) throw new Error("Material sem custo de referência");
      const divergentSheets = usage.usages.filter((u) => u.cost_divergent);
      for (const u of divergentSheets) {
        const { error } = await supabase
          .from("tech_sheet_materials")
          .update({ unit_cost: usage.reference_cost })
          .eq("tech_sheet_id", u.tech_sheet_id)
          .eq("material_id", materialId);
        if (error) throw error;
      }
      return divergentSheets.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} ficha(s) atualizada(s) com o custo da biblioteca`);
      qc.invalidateQueries({ queryKey: ["material-library-usage", materialId] });
      qc.invalidateQueries({ queryKey: ["ts-materials"] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const divergentCount = usage?.usages.filter((u) => u.cost_divergent).length ?? 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl border border-border shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="size-10 rounded-lg shrink-0 border"
              style={{
                background: usage?.color_hex || "hsl(var(--muted))",
              }}
            />
            <div className="min-w-0">
              <div className="font-semibold truncate">{usage?.material_name ?? "Carregando…"}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {usage?.material_code} · {usage?.material_kind}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {usage?.reference_cost != null && (
              <Badge variant="outline" className="text-[11px]">
                Custo ref. {brl(usage.reference_cost)}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="size-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : !usage ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Material não encontrado.
            </div>
          ) : usage.usages.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground space-y-2">
              <Layers className="size-8 mx-auto opacity-40" />
              <div>Este material não está sendo usado em nenhuma ficha técnica.</div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="text-[11px]">
                  {usage.usages.length} ficha(s)
                </Badge>
                {divergentCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1"
                  >
                    <AlertTriangle className="size-3" />
                    {divergentCount} com custo divergente
                  </Badge>
                )}
                {divergentCount === 0 && usage.usages.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1"
                  >
                    <CheckCircle2 className="size-3" />
                    Todos os custos sincronizados
                  </Badge>
                )}
              </div>

              {/* Table */}
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Ficha</TableHead>
                      <TableHead className="text-right">Consumo</TableHead>
                      <TableHead className="text-right">Custo BOM</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-20 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.usages.map((u) => (
                      <TableRow key={u.tech_sheet_id}>
                        <TableCell>
                          <a
                            href={`/produto/${u.product_id}`}
                            className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                          >
                            {u.product_sku}
                            <ExternalLink className="size-2.5" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono">{u.tech_sheet_code}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {u.bom_consumption.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              u.cost_divergent
                                ? "text-amber-600 font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            {brl(u.bom_unit_cost)}
                            {u.cost_divergent && " ⚠"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium">
                          {brl(u.bom_total)}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.cost_divergent ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30"
                            >
                              Divergente
                            </Badge>
                          ) : (
                            <CheckCircle2 className="size-3.5 text-emerald-600 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {usage && usage.usages.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-[11px] text-muted-foreground">
              {usage.reference_cost != null
                ? `Custo de referência: ${brl(usage.reference_cost)}`
                : "Sem custo de referência definido"}
            </div>
            <Button
              size="sm"
              onClick={() => syncCosts.mutate()}
              disabled={divergentCount === 0 || syncCosts.isPending || !usage.reference_cost}
              className="gap-1"
            >
              {syncCosts.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sincronizar custos ({divergentCount})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

