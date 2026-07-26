import { useState } from "react";
import { FileDown, Loader2, Settings2, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type CoverOpts = {
  brand: string;
  logoUrl: string;
  client: string;
  season: string;
  contact: string;
  accent: string;
};

const LS_KEY = "tech-pack-cover-opts";
const defaultOpts: CoverOpts = {
  brand: "",
  logoUrl: "",
  client: "",
  season: "",
  contact: "",
  accent: "#141414",
};

function loadOpts(): CoverOpts {
  if (typeof window === "undefined") return defaultOpts;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return defaultOpts;
    return { ...defaultOpts, ...JSON.parse(raw) };
  } catch {
    return defaultOpts;
  }
}

function saveOpts(o: CoverOpts) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [20, 20, 20];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

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
  const [openCfg, setOpenCfg] = useState(false);
  const [opts, setOpts] = useState<CoverOpts>(() => loadOpts());

  const exportPdf = async (coverOpts: CoverOpts, audience: "interna" | "fornecedor" = "interna") => {
    const showCosts = audience === "interna";
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
      const [ar, ag, ab] = hexToRgb(coverOpts.accent);

      // ---------- CAPA customizável ----------
      doc.setFillColor(ar, ag, ab);
      doc.rect(0, 0, pageW, 110, "F");
      doc.setTextColor(255);
      doc.setFontSize(9);
      doc.text((coverOpts.brand || "TECH PACK").toUpperCase(), 40, 32);
      doc.setFontSize(20);
      doc.text(productName ?? "Produto", 40, 62);
      doc.setFontSize(10);
      doc.text(
        [coverOpts.client, coverOpts.season].filter(Boolean).join(" · ") || "Ficha técnica",
        40,
        84,
      );

      // Logo (canto direito da faixa)
      if (coverOpts.logoUrl) {
        const logo = await loadImageDataUrl(coverOpts.logoUrl);
        if (logo) {
          try {
            const fmt = /^data:image\/png/i.test(logo) ? "PNG" : "JPEG";
            doc.addImage(logo, fmt, pageW - 110, 20, 70, 70);
          } catch {
            /* ignore */
          }
        }
      }

      doc.setTextColor(30);
      doc.setFontSize(11);
      let capaY = 140;
      const capaLines = [
        `SKU: ${productSku ?? "—"}`,
        `Código ficha: ${code}`,
        `Versão: ${version}`,
        `Status: ${status ?? "—"}`,
        `Gerado: ${new Date().toLocaleString("pt-BR")}`,
      ];
      capaLines.forEach((line) => {
        doc.text(line, 40, capaY);
        capaY += 18;
      });

      if (productImage) {
        const dataUrl = await loadImageDataUrl(productImage);
        if (dataUrl) {
          try {
            doc.addImage(dataUrl, "JPEG", pageW - 220, 130, 180, 180);
          } catch {
            /* ignore */
          }
        }
      }

      // Rodapé de contato na capa
      if (coverOpts.contact) {
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`Contato: ${coverOpts.contact}`, 40, 340);
      }

      let cursorY = 370;

      // ---------- BOM ----------
      doc.setTextColor(0);
      doc.setFontSize(13);
      doc.text("BOM · Lista de materiais", 40, cursorY);
      cursorY += 8;
      autoTable(doc, {
        startY: cursorY,
        head: [
          showCosts
            ? ["Material", "Unid.", "Consumo", "Perda %", "Custo unit.", "Total"]
            : ["Material", "Unid.", "Consumo", "Perda %"],
        ],
        body: materials.map((m) =>
          showCosts
            ? [
                m.name,
                m.unit ?? "",
                String(m.consumption ?? 0),
                `${((m.loss_pct as number) ?? 0).toFixed(1)}%`,
                fmtBRL(m.unit_cost as number),
                fmtBRL(m.total_cost as number),
              ]
            : [m.name, m.unit ?? "", String(m.consumption ?? 0), `${((m.loss_pct as number) ?? 0).toFixed(1)}%`],
        ),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [ar, ag, ab] },
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
        head: [
          showCosts
            ? ["Operação", "Máquina", "Setor", "SAM (min)", "R$/min", "Custo"]
            : ["Operação", "Máquina", "Setor", "SAM (min)"],
        ],
        body: operations.map((o) =>
          showCosts
            ? [
                o.name,
                o.machine ?? "",
                o.responsible_role ?? "",
                String(o.sam ?? 0),
                fmtBRL(o.rate_per_min as number),
                fmtBRL(o.total_cost as number),
              ]
            : [o.name, o.machine ?? "", o.responsible_role ?? "", String(o.sam ?? 0)],
        ),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [ar, ag, ab] },
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
          headStyles: { fillColor: [ar, ag, ab] },
          margin: { left: 40, right: 40 },
        });
      }

      // ---------- Rodapé numérico ----------
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140);
        const footer = [
          coverOpts.brand,
          `Ficha ${code} v${version}`,
          productSku ?? "",
          `Página ${i}/${totalPages}`,
        ]
          .filter(Boolean)
          .join(" · ");
        doc.text(footer, 40, pageH - 24);
      }

      doc.save(`tech-pack-${code}-v${version}${audience === "fornecedor" ? "-fornecedor" : ""}.pdf`);
      toast.success(`Tech Pack ${audience === "fornecedor" ? "(fornecedor)" : "(interno)"} exportado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    saveOpts(opts);
    setOpenCfg(false);
    await exportPdf(opts);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => exportPdf(opts)} disabled={busy}>
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
      <Dialog open={openCfg} onOpenChange={setOpenCfg}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            title="Configurar capa"
            disabled={busy}
          >
            <Settings2 className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Capa do Tech Pack</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Marca">
              <Input
                value={opts.brand}
                onChange={(e) => setOpts({ ...opts, brand: e.target.value })}
                placeholder="USE Moda"
              />
            </Field>
            <Field label="Logo (URL)">
              <Input
                value={opts.logoUrl}
                onChange={(e) => setOpts({ ...opts, logoUrl: e.target.value })}
                placeholder="https://…/logo.png"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente / marca própria">
                <Input
                  value={opts.client}
                  onChange={(e) => setOpts({ ...opts, client: e.target.value })}
                  placeholder="Marca X"
                />
              </Field>
              <Field label="Estação">
                <Input
                  value={opts.season}
                  onChange={(e) => setOpts({ ...opts, season: e.target.value })}
                  placeholder="Verão 26"
                />
              </Field>
            </div>
            <Field label="Contato">
              <Input
                value={opts.contact}
                onChange={(e) => setOpts({ ...opts, contact: e.target.value })}
                placeholder="dev@marca.com · +55 47 9xxxx-xxxx"
              />
            </Field>
            <Field label="Cor de destaque">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={opts.accent}
                  onChange={(e) => setOpts({ ...opts, accent: e.target.value })}
                  className="h-9 w-12 rounded border border-border cursor-pointer"
                />
                <Input
                  value={opts.accent}
                  onChange={(e) => setOpts({ ...opts, accent: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Preferências salvas neste navegador para os próximos exports.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCfg(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={busy}>
              Salvar e gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
