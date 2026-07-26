import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { scanTrendRadar, type TrendSignal } from "@/lib/trend-radar.functions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radar, Loader2, TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  collectionId?: string;
};

function paletteSvgDataUrl(title: string, colors: string[]): string {
  const swatches = colors.length > 0 ? colors : ["#ddd"];
  const w = 400;
  const h = 400;
  const sw = w / swatches.length;
  const rects = swatches
    .map((c, i) => `<rect x="${i * sw}" y="0" width="${sw}" height="${h}" fill="${c}"/>`)
    .join("");
  const safe = title.replace(/[<>&]/g, "").slice(0, 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects}<rect x="0" y="${h - 60}" width="${w}" height="60" fill="rgba(0,0,0,0.55)"/><text x="20" y="${h - 22}" font-family="Inter,Arial" font-size="20" fill="#fff" font-weight="600">${safe}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function TrendRadarPanel({ collectionId }: Props = {}) {
  const fn = useServerFn(scanTrendRadar);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [horizon, setHorizon] = useState<"now" | "next-season" | "next-year">("next-season");
  const [pinning, setPinning] = useState<number | null>(null);

  const m = useMutation({
    mutationFn: () =>
      fn({ data: { horizon } }) as Promise<{ signals: TrendSignal[]; brandContext: string }>,
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao escanear tendências"),
  });

  const signals = m.data?.signals ?? [];

  const pinToMood = async (idx: number, s: TrendSignal) => {
    if (!collectionId || !user) return;
    setPinning(idx);
    try {
      const caption = `${s.title} · ${s.category} · #${s.keywords.slice(0, 3).join(" #")}`;
      const image_url = paletteSvgDataUrl(s.title, s.colors);
      const { error } = await supabase.from("collection_moodboard").insert({
        collection_id: collectionId,
        owner_id: user.id,
        image_url,
        caption,
        kind: "tendencia",
      });
      if (error) throw error;
      toast.success("Tendência adicionada ao moodboard");
      qc.invalidateQueries({ queryKey: ["moodboard", collectionId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao pinar");
    } finally {
      setPinning(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radar className="size-4 text-primary" /> Trend Radar · score de relevância p/ a marca
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            IA cruza paleta e categorias atuais com tendências do horizonte escolhido.
            {collectionId ? " Pin direto no moodboard desta coleção." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={horizon}
            onValueChange={(v) => setHorizon(v as "now" | "next-season" | "next-year")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="now">Agora</SelectItem>
              <SelectItem value="next-season">Próxima estação</SelectItem>
              <SelectItem value="next-year">Próximo ano</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => m.mutate()} disabled={m.isPending} className="gap-2">
            {m.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <TrendingUp className="size-4" />
            )}
            Escanear
          </Button>
        </div>
      </div>

      {signals.length === 0 && !m.isPending && (
        <div className="text-xs text-muted-foreground text-center py-6">
          Clique em "Escanear" para gerar os sinais.
        </div>
      )}

      {signals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {signals.map((s, i) => {
            const tone =
              s.relevance >= 75
                ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                : s.relevance >= 50
                  ? "text-amber-500 border-amber-500/30 bg-amber-500/5"
                  : "text-muted-foreground border-border bg-muted/30";
            return (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{s.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.category}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium tabular-nums ${tone}`}
                  >
                    {s.relevance}%
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{s.summary}</p>
                {s.colors.length > 0 && (
                  <div className="flex gap-1">
                    {s.colors.map((c, j) => (
                      <div
                        key={j}
                        className="size-4 rounded border border-border"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                )}
                {s.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.keywords.map((k, j) => (
                      <span
                        key={j}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        #{k}
                      </span>
                    ))}
                  </div>
                )}
                {s.why && (
                  <div className="text-[11px] text-foreground/80 italic border-l-2 border-primary/40 pl-2">
                    {s.why}
                  </div>
                )}
                {collectionId && (
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => pinToMood(i, s)}
                      disabled={pinning === i}
                    >
                      {pinning === i ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : (
                        <Plus className="size-3 mr-1" />
                      )}
                      Pin no moodboard
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
