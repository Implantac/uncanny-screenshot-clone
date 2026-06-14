import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Palette, Sparkles, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/trends")({ component: Trends });

type Product = { id: string; name: string; category: string | null; image_url: string | null; colors: string[] | null; sell_price: number | null };

async function load() {
  const { data } = await supabase.from("products").select("id, name, category, image_url, colors, sell_price").order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}

function Trends() {
  const { data: products = [], isLoading } = useQuery({ queryKey: ["trends"], queryFn: load });
  const [active, setActive] = useState<string>("all");

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

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hub de Tendências</h1>
        <p className="text-sm text-muted-foreground">Moodboard, paleta e referências visuais a partir do catálogo.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-dashed border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[160px]">
          <Upload className="size-8 text-muted-foreground" />
          <div>
            <div className="font-medium">Arraste imagens, PDFs ou vídeos</div>
            <div className="text-xs text-muted-foreground mt-1">Upload com análise por IA (cores, tecidos, modelagens) — em breve.</div>
          </div>
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
