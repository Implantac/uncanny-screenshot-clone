import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { suggestPaletteFabric, type DesignerSuggestion } from "@/lib/designer-ai.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Palette, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

export function DesignerAIAssistant() {
  const fn = useServerFn(suggestPaletteFabric);
  const [brief, setBrief] = useState("");
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");

  const m = useMutation({
    mutationFn: (vars: { brief: string; season?: string; category?: string }) =>
      fn({ data: vars }) as Promise<DesignerSuggestion>,
    onError: (e: Error) => toast.error(e.message || "Falha ao gerar sugestão"),
  });

  const data = m.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Assistente de moodboard · IA
        </CardTitle>
        <CardDescription>
          Descreva o briefing e receba paleta de cores e sugestões de tecido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            placeholder="Estação (ex.: Verão 2027)"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
          <Input
            placeholder="Categoria (ex.: Vestidos)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <Textarea
          placeholder="Ex.: cápsula resort minimalista, inspiração mediterrânea, alfaiataria fluida para clima quente…"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
        />
        <Button
          onClick={() =>
            m.mutate({
              brief: brief.trim(),
              season: season.trim() || undefined,
              category: category.trim() || undefined,
            })
          }
          disabled={brief.trim().length < 3 || m.isPending}
          className="gap-2"
        >
          {m.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Gerar paleta + tecidos
        </Button>

        {data && (
          <div className="space-y-4 pt-2">
            {data.mood && <div className="text-sm text-muted-foreground italic">"{data.mood}"</div>}

            {data.palette.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Palette className="size-3" /> Paleta
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {data.palette.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        navigator.clipboard.writeText(c.hex);
                        toast.success(`${c.hex} copiado`);
                      }}
                      className="rounded-lg overflow-hidden border border-border text-left hover:border-primary/40 transition-colors"
                      title="Clique para copiar"
                    >
                      <div className="h-12" style={{ backgroundColor: c.hex }} />
                      <div className="p-2">
                        <div className="text-xs font-medium truncate">{c.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          {c.hex} <Copy className="size-2.5" />
                        </div>
                        <div className="text-[10px] text-muted-foreground capitalize">
                          {c.usage}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {data.fabrics.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Tecidos sugeridos
                </div>
                <div className="space-y-2">
                  {data.fabrics.map((f, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-medium">{f.name}</div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {f.composition}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{f.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.refs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.refs.map((r, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    #{r}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
