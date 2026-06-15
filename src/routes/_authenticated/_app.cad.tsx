import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { PenTool, Download, Eye, Loader2, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/cad")({
  validateSearch: zodValidator(z.object({
    q: fallback(z.string().trim().max(80), "").default(""),
    cat: fallback(z.string().trim().max(40), "all").default("all"),
  })),
  head: () => ({
    meta: [
      { title: "CAD e Modelagem · USE MODA OS" },
      { name: "description", content: "Biblioteca de moldes e modelagem digital." },
    ],
  }),
  component: CAD,
});

const GRADIENTS = [
  "from-rose-400/40 to-pink-600/40",
  "from-violet-400/40 to-indigo-600/40",
  "from-cyan-400/40 to-teal-600/40",
  "from-amber-400/40 to-orange-600/40",
  "from-emerald-400/40 to-green-600/40",
  "from-sky-400/40 to-blue-600/40",
  "from-stone-400/40 to-zinc-600/40",
  "from-fuchsia-400/40 to-purple-600/40",
];

type Molde = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sizes: string[] | null;
  colors: string[] | null;
  grade: string | null;
  image_url: string | null;
  updated_at: string;
  description: string | null;
};

function CAD() {
  useRealtime("products", ["cad-products"]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [selected, setSelected] = useState<Molde | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cad-products"],
    queryFn: async () => {
      const [{ data: products, error }, { count: protoCount }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, category, sizes, colors, grade, image_url, updated_at, description")
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase.from("prototypes").select("id", { count: "exact", head: true }),
      ]);
      if (error) throw error;
      return { products: (products ?? []) as Molde[], protoCount: protoCount ?? 0 };
    },
  });

  const moldes = data?.products ?? [];
  const categories = useMemo(
    () => Array.from(new Set(moldes.map((m) => m.category).filter(Boolean))) as string[],
    [moldes],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return moldes.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) ||
        m.sku.toLowerCase().includes(term) ||
        (m.category ?? "").toLowerCase().includes(term)
      );
    });
  }, [moldes, q, cat]);

  const kpis = [
    { l: "Moldes ativos", v: moldes.length.toLocaleString("pt-BR") },
    { l: "Protótipos", v: (data?.protoCount ?? 0).toLocaleString("pt-BR") },
    { l: "Categorias", v: categories.length },
    {
      l: "Atualizações 30d",
      v: moldes.filter((m) => new Date(m.updated_at).getTime() > Date.now() - 30 * 864e5).length,
    },
  ];

  function exportSpec(m: Molde) {
    const spec = {
      format: "USE-MODA-CAD-SPEC/1.0",
      target: ["Audaces", "Optitex"],
      exported_at: new Date().toISOString(),
      molde: {
        sku: m.sku,
        name: m.name,
        category: m.category,
        grade: m.grade,
        sizes: m.sizes ?? [],
        colors: m.colors ?? [],
        image_url: m.image_url,
        description: m.description,
      },
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `molde-${m.sku}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Spec ${m.sku} exportada`);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <PenTool className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CAD e Modelagem</h1>
          <p className="text-sm text-muted-foreground">
            Biblioteca de moldes · integração Audaces / Optitex
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por SKU, nome ou categoria…"
            className="pl-9"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-6 grid place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 grid place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">
          {moldes.length === 0
            ? "Nenhum molde cadastrado ainda. Crie produtos para alimentar a biblioteca."
            : "Nenhum molde corresponde aos filtros."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((m, i) => {
            const grade =
              (m.sizes ?? []).length ? `${m.sizes![0]}-${m.sizes![m.sizes!.length - 1]}` : "—";
            return (
              <div
                key={m.id}
                className="glass rounded-xl overflow-hidden hover:border-primary/40 transition-colors"
              >
                <div className={`h-32 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} relative`}>
                  {m.image_url ? (
                    <img
                      src={m.image_url}
                      alt={m.name}
                      className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-80"
                      loading="lazy"
                    />
                  ) : (
                    <svg
                      className="absolute inset-0 w-full h-full opacity-30"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <path d="M20,10 L80,10 L70,90 L30,90 Z" fill="none" stroke="white" strokeWidth="0.5" />
                      <path d="M30,30 L70,30" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" />
                      <path d="M28,60 L72,60" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" />
                    </svg>
                  )}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] text-white tabular-nums">
                    {m.category ?? "—"}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground tabular-nums">{m.sku}</div>
                  <div className="font-medium text-sm mt-0.5 leading-tight truncate">{m.name}</div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>Grade</span>
                      <span className="text-foreground/80 tabular-nums">{m.grade ?? grade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cores</span>
                      <span className="text-foreground/80 tabular-nums">{m.colors?.length ?? 0}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setSelected(m)}
                      className="flex-1 h-8 rounded-md bg-muted text-xs hover:bg-muted/70 inline-flex items-center justify-center gap-1.5"
                    >
                      <Eye className="size-3.5" /> Abrir
                    </button>
                    <button
                      onClick={() => exportSpec(m)}
                      title="Exportar spec (Audaces/Optitex)"
                      className="size-8 rounded-md bg-muted hover:bg-muted/70 grid place-items-center text-muted-foreground"
                    >
                      <Download className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg overflow-hidden bg-muted aspect-square grid place-items-center">
                  {selected.image_url ? (
                    <img
                      src={selected.image_url}
                      alt={selected.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PenTool className="size-10 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">SKU</div>
                    <div className="font-mono">{selected.sku}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Categoria</div>
                    <div>{selected.category ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Grade de tamanhos</div>
                    <div className="flex flex-wrap gap-1">
                      {(selected.sizes ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
                      {(selected.sizes ?? []).map((s) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Cores</div>
                    <div className="flex flex-wrap gap-1">
                      {(selected.colors ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
                      {(selected.colors ?? []).map((c) => (
                        <Badge key={c} variant="outline">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Atualizado em</div>
                    <div className="tabular-nums">
                      {new Date(selected.updated_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
              </div>
              {selected.description && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selected.description}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
                <Button onClick={() => exportSpec(selected)}>
                  <Download className="size-4 mr-2" /> Exportar spec
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
