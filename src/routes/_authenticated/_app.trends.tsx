import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useRef, useState } from "react";
import { Palette, Sparkles, Upload, Loader2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { analyzeTrendImage } from "@/lib/trends.functions";
import { TrendRadarPanel } from "@/components/trend-radar-panel";

export const Route = createFileRoute("/_authenticated/_app/trends")({ component: Trends });

type Product = { id: string; name: string; category: string | null; image_url: string | null; colors: string[] | null; sell_price: number | null };

async function load() {
  const { data } = await supabase.from("products").select("id, name, category, image_url, colors, sell_price").order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = () => rej(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function Trends() {
  const { data: products = [], isLoading } = useQuery({ queryKey: ["trends"], queryFn: load });
  const [active, setActive] = useState<string>("all");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzeTrendImage);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 4 * 1024 * 1024) throw new Error("Imagem maior que 4MB");
      const url = await fileToDataUrl(file);
      setPreview(url);
      return analyze({ data: { imageDataUrl: url } });
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: () => toast.success("Análise concluída"),
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  const palette = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => (p.colors ?? []).forEach((c) => map.set(c, (map.get(c) ?? 0) + 1)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16);
  }, [products]);

  const filtered = active === "all" ? products : products.filter((p) => p.category === active);
  const result = mutation.data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hub de Tendências</h1>
        <p className="text-sm text-muted-foreground">Moodboard, paleta e análise visual por IA.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-dashed border-border bg-card p-4 sm:p-6">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) mutation.mutate(f); e.currentTarget.value = ""; }} />
          {!preview && !mutation.isPending && (
            <button onClick={() => fileRef.current?.click()} className="w-full flex flex-col items-center justify-center text-center gap-3 min-h-[160px] hover:bg-muted/30 transition rounded-lg">
              <Upload className="size-8 text-muted-foreground" />
              <div>
                <div className="font-medium">Enviar referência visual</div>
                <div className="text-xs text-muted-foreground mt-1">IA identifica categoria, estilo, cores e tendências (até 4MB).</div>
              </div>
            </button>
          )}
          {(preview || mutation.isPending) && (
            <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
              <div className="relative">
                {preview && <img src={preview} alt="" className="w-[120px] h-[120px] object-cover rounded-lg border border-border" />}
                <button onClick={() => { setPreview(null); mutation.reset(); }} className="absolute -top-2 -right-2 size-6 rounded-full bg-background border border-border grid place-items-center hover:bg-muted"><X className="size-3" /></button>
              </div>
              <div className="min-w-0 space-y-2 text-xs">
                {mutation.isPending && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Analisando com IA…</div>}
                {result && (
                  <>
                    <div className="font-semibold text-sm">{result.categoria} · <span className="text-muted-foreground font-normal">{result.estilo}</span></div>
                    <p className="text-muted-foreground">{result.descricao}</p>
                    {result.cores.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {result.cores.map((c) => <span key={c} className="size-5 rounded border border-border" style={{ background: c }} title={c} />)}
                      </div>
                    )}
                    {result.tecidos.length > 0 && <div><span className="text-muted-foreground">Tecidos: </span>{result.tecidos.join(", ")}</div>}
                    {result.tendencias.length > 0 && (
                      <div className="flex gap-1 flex-wrap pt-1">
                        {result.tendencias.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px]">{t}</span>)}
                      </div>
                    )}
                    <Link
                      to="/produtos"
                      search={{
                        q: "",
                        prefillName: result.descricao?.slice(0, 60) || result.categoria,
                        prefillCategory: result.categoria,
                        prefillColors: (result.cores ?? []).join(", "),
                      }}
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                    >
                      <Plus className="size-3.5" /> Virar produto
                    </Link>
                  </>
                )}
                {mutation.error && <div className="text-destructive">{(mutation.error as Error).message}</div>}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><Palette className="size-3.5" /> Paleta predominante</div>
          <div className="grid grid-cols-8 gap-1">
            {palette.length === 0 ? <div className="col-span-8 text-xs text-muted-foreground">Sem cores cadastradas.</div> :
              palette.map(([c, n]) => (
                <div key={c} className="aspect-square rounded border border-border text-[9px] flex items-end justify-center pb-0.5 text-white/80 font-mono" style={{ background: c, textShadow: "0 0 4px rgba(0,0,0,0.6)" }} title={`${c} (${n})`}>{n}</div>
              ))}
          </div>
        </div>
      </div>

      <TrendRadarPanel />


      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c} onClick={() => setActive(c)} className={`text-xs px-3 py-1.5 rounded-full border transition ${active === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>{c === "all" ? "Todos" : c}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {isLoading ? <div className="col-span-full text-center text-muted-foreground py-12">Carregando…</div> :
          filtered.length === 0 ? <div className="col-span-full text-center text-muted-foreground py-12">Sem referências.</div> :
          filtered.slice(0, 60).map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden group">
              <div className="aspect-square bg-muted relative overflow-hidden">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" /> :
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Sparkles className="size-6" /></div>}
              </div>
              <div className="p-2">
                <div className="text-xs font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">{p.category ?? "—"}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
