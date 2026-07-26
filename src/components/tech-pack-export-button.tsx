import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  sheetId: string;
  code: string;
  version: string;
  productName?: string | null;
  productSku?: string | null;
  productImage?: string | null;
  status?: string | null;
};

const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("read error"));
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function TechPackExportButton({
  sheetId,
  code,
  version,
  productName,
  productSku,
  productImage,
  status,
}: Props) {
  const [busy, setBusy] = useState(false);

  const exportPdf = async () => {
    setBusy(true);
    try {
      const [{ default: jsPDF }, autoTableMod, materialsRes, opsRes, measRes] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
        supabase
          .from("tech_sheet_materials")
          .select("name, unit, consumption, loss_pct, unit_cost, total_cost, position")
          .eq("tech_sheet_id", sheetId)
          .order("position"),
        supabase
          .from("tech_sheet_operations")
          .select("name, machine, responsible_role, sam, rate_per_min, total_cost, position")
          .eq("tech_sheet_id", sheetId)
          .order("position"),
        supabase
          .from("tech_sheet_measurements")
          .select("point, tolerance_plus, tolerance_minus, sizes, position")
          .eq("tech_sheet_id", sheetId)
          .order("position"),
      ]);

      const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default;
      const materials = materialsRes.data ?? [];
      const operations = opsRes.data ?? [];
      const measurements = measRes.data ?? [];

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // ---------- CAPA ----------
      doc.setFillColor(20, 20, 20);
      doc.rect(0, 0, pageW, 80, "F");
      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.text("FICHA TÉCNICA · TECH PACK", 40, 32);
      doc.setFontSize(20);
      doc.text(productName ?? "Produto", 40, 60);
      doc.setTextColor(30);
      doc.setFontSize(11);
      doc.text(`SKU: ${productSku ?? "—"}`, 40, 110);
      doc.text(`Código ficha: ${code}`, 40, 128);
      doc.text(`Versão: ${version}`, 40, 146);
      doc.text(`Status: ${status ?? "—"}`, 40, 164);
      doc.text(`Gerado: ${new Date().toLocaleString("pt-BR")}`, 40, 182);

      if (productImage) {
        const dataUrl = await loadImageDataUrl(productImage);
        if (dataUrl) {
          try {
            doc.addImage(dataUrl, "JPEG", pageW - 220, 100, 180, 180);
          } catch {
            /* ignore image failure */
          }
        }
      }

      let cursorY = 320;

      // ---------- BOM ----------
      doc.setTextColor(0);
      doc.setFontSize(13);
      doc.text("BOM · Lista de materiais", 40, cursorY);
      cursorY += 8;
      autoTable(doc, {
        startY: cursorY,
        head: [["Material", "Unid.", "Consumo", "Perda %", "Custo unit.", "Total"]],
        body: materials.map((m) => [
          m.name,
          m.unit ?? "",
          String(m.consumption ?? 0),
          `${((m.loss_pct as number) ?? 0).toFixed(1)}%`,
          fmtBRL(m.unit_cost as number),
          fmtBRL(m.total_cost as number),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [40, 40, 40] },
        margin: { left: 40, right: 40 },
      });
      // @ts-expect-error autotable augments doc
      cursorY = doc.lastAutoTable.finalY + 24;

      if (cursorY > pageH - 200) {
        doc.addPage();
        cursorY = 60;
      }

      // ---------- BOP ----------
      doc.setFontSize(13);
      doc.text("BOP · Sequência de operações", 40, cursorY);
      cursorY += 8;
      autoTable(doc, {
        startY: cursorY,
        head: [["Operação", "Máquina", "Setor", "SAM (min)", "R$/min", "Custo"]],
        body: operations.map((o) => [
          o.name,
          o.machine ?? "",
          o.responsible_role ?? "",
          String(o.sam ?? 0),
          fmtBRL(o.rate_per_min as number),
          fmtBRL(o.total_cost as number),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [40, 40, 40] },
        margin: { left: 40, right: 40 },
      });
      // @ts-expect-error autotable augments doc
      cursorY = doc.lastAutoTable.finalY + 24;

      if (cursorY > pageH - 200) {
        doc.addPage();
        cursorY = 60;
      }

      // ---------- Medidas ----------
      if (measurements.length > 0) {
        doc.setFontSize(13);
        doc.text("Medidas & Tolerâncias", 40, cursorY);
        cursorY += 8;
        const sizeKeys = Array.from(
          new Set(
            measurements.flatMap((m) => Object.keys((m.sizes as Record<string, number>) ?? {})),
          ),
        );
        autoTable(doc, {
          startY: cursorY,
          head: [["POM", "Tol. +", "Tol. -", ...sizeKeys]],
          body: measurements.map((m) => [
            m.point,
            `+${m.tolerance_plus ?? 0}`,
            `-${m.tolerance_minus ?? 0}`,
            ...sizeKeys.map((k) => {
              const v = (m.sizes as Record<string, number> | null)?.[k];
              return v != null ? String(v) : "—";
            }),
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [40, 40, 40] },
          margin: { left: 40, right: 40 },
        });
      }

      // ---------- Rodapé numérico ----------
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `Ficha ${code} v${version} · ${productSku ?? ""} · Página ${i}/${totalPages}`,
          40,
          pageH - 24,
        );
      }

      doc.save(`tech-pack-${code}-v${version}.pdf`);
      toast.success("Tech Pack exportado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={exportPdf} disabled={busy}>
      {busy ? (
        <>
          <Loader2 className="size-4 mr-1 animate-spin" /> Gerando…
        </>
      ) : (
        <>
          <FileDown className="size-4 mr-1" /> Tech Pack PDF
        </>
      )}
    </Button>
  );
}
