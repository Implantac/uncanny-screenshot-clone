import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ruler, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

type Measurement = {
  id: string;
  point: string;
  position: number;
  sizes: Record<string, number>;
  tolerance_plus: number;
  tolerance_minus: number;
};

type Props = {
  fitSessionId: string;
  prototypeId: string | null;
};

export function MeasurementCheckPanel({ fitSessionId, prototypeId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [size, setSize] = useState<string>("");
  const [measured, setMeasured] = useState<Record<string, string>>({});

  const ctx = useQuery({
    queryKey: ["fit-measurements-ctx", prototypeId],
    enabled: !!prototypeId,
    queryFn: async () => {
      const proto = await supabase
        .from("prototypes")
        .select("id, product_id")
        .eq("id", prototypeId!)
        .maybeSingle();
      const productId = proto.data?.product_id;
      if (!productId) return { measurements: [] as Measurement[], techSheetCode: null as string | null };
      const sheet = await supabase
        .from("tech_sheets")
        .select("id, code, version")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sheet.data) return { measurements: [], techSheetCode: null };
      const meas = await supabase
        .from("tech_sheet_measurements")
        .select("id, point, position, sizes, tolerance_plus, tolerance_minus")
        .eq("tech_sheet_id", sheet.data.id)
        .order("position");
      return {
        measurements: ((meas.data ?? []) as unknown as Measurement[]),
        techSheetCode: `${sheet.data.code} v${sheet.data.version}`,
      };
    },
  });

  const measurements = ctx.data?.measurements ?? [];
  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    measurements.forEach((m) => Object.keys(m.sizes ?? {}).forEach((s) => set.add(s)));
    return Array.from(set);
  }, [measurements]);

  const effectiveSize = size || sizeOptions[0] || "";

  const rows = useMemo(() => {
    return measurements.map((m) => {
      const spec = Number(m.sizes?.[effectiveSize] ?? 0);
      const raw = measured[m.id];
      const actual = raw === undefined || raw === "" ? null : Number(raw);
      const delta = actual === null ? null : actual - spec;
      const outOfTolerance =
        actual === null || spec === 0
          ? false
          : delta! > m.tolerance_plus || delta! < -m.tolerance_minus;
      const severity: "critico" | "ajuste" | "ok" =
        actual === null
          ? "ok"
          : outOfTolerance
            ? Math.abs(delta!) > Math.max(m.tolerance_plus, m.tolerance_minus) * 2
              ? "critico"
              : "ajuste"
            : "ok";
      return { m, spec, actual, delta, outOfTolerance, severity };
    });
  }, [measurements, measured, effectiveSize]);

  const flagAsComment = useMutation({
    mutationFn: async (row: (typeof rows)[number]) => {
      if (!user) throw new Error("Sem usuário");
      if (row.actual === null) throw new Error("Informe a medida");
      const comment =
        `Medido ${row.actual}cm vs spec ${row.spec}cm (Δ ${row.delta! >= 0 ? "+" : ""}${row.delta!.toFixed(1)}cm) ` +
        `no tamanho ${effectiveSize}. Tolerância ±${row.m.tolerance_plus}/${row.m.tolerance_minus}cm.`;
      const { error } = await supabase.from("fit_session_comments").insert({
        owner_id: user.id,
        fit_session_id: fitSessionId,
        pom_label: row.m.point,
        severity: row.severity === "ok" ? "ajuste" : row.severity,
        comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Apontamento criado a partir da medida");
      qc.invalidateQueries({ queryKey: ["fit-comments", fitSessionId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!prototypeId) {
    return (
      <div className="glass rounded-xl p-4 text-xs text-muted-foreground">
        <Ruler className="h-4 w-4 inline mr-1" />
        Vincule esta prova a um protótipo para carregar medidas da ficha técnica.
      </div>
    );
  }
  if (ctx.isLoading) {
    return <div className="glass rounded-xl p-4 text-xs text-muted-foreground">Carregando medidas…</div>;
  }
  if (measurements.length === 0) {
    return (
      <div className="glass rounded-xl p-4 text-xs text-muted-foreground">
        <Ruler className="h-4 w-4 inline mr-1" />
        Ficha técnica sem pontos de medida. Cadastre em Ficha Técnica → Medidas.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Medidas vs Tolerância</span>
          <span className="text-xs text-muted-foreground">
            {ctx.data?.techSheetCode ? `· ${ctx.data.techSheetCode}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tamanho:</span>
          <select
            value={effectiveSize}
            onChange={(e) => setSize(e.target.value)}
            className="h-8 rounded-md border border-border bg-background text-xs px-2"
          >
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 pr-2">Ponto</th>
              <th className="py-2 px-2 text-right">Spec (cm)</th>
              <th className="py-2 px-2 text-right">Tol ±</th>
              <th className="py-2 px-2 text-right">Medido</th>
              <th className="py-2 px-2 text-right">Δ</th>
              <th className="py-2 pl-2">Status</th>
              <th className="py-2 pl-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m.id} className="border-b border-border/40">
                <td className="py-2 pr-2 font-medium">{r.m.point}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.spec.toFixed(1)}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                  +{r.m.tolerance_plus}/-{r.m.tolerance_minus}
                </td>
                <td className="py-2 px-2 text-right">
                  <Input
                    type="number"
                    step="0.1"
                    value={measured[r.m.id] ?? ""}
                    onChange={(e) => setMeasured({ ...measured, [r.m.id]: e.target.value })}
                    className="h-7 text-xs text-right w-20 ml-auto"
                  />
                </td>
                <td
                  className={`py-2 px-2 text-right tabular-nums ${
                    r.actual === null
                      ? "text-muted-foreground"
                      : r.outOfTolerance
                        ? "text-red-600 font-semibold"
                        : "text-emerald-600"
                  }`}
                >
                  {r.actual === null ? "—" : `${r.delta! >= 0 ? "+" : ""}${r.delta!.toFixed(1)}`}
                </td>
                <td className="py-2 pl-2">
                  {r.actual === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : r.outOfTolerance ? (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      {r.severity === "critico" ? "Crítico" : "Ajuste"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Ok
                    </span>
                  )}
                </td>
                <td className="py-2 pl-2 text-right">
                  {r.outOfTolerance && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => flagAsComment.mutate(r)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Apontar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Δ &gt; 2× tolerância vira apontamento <b>crítico</b> (bloqueia aprovação); dentro de 2× vira{" "}
        <b>ajuste</b>. Apontar cria comentário técnico ligado ao ponto de medida.
      </p>
    </div>
  );
}
