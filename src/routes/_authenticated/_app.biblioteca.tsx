import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search, Library, Sparkles, ImageOff } from "lucide-react";
import {
  listReferenceLibrary,
  type RefItem,
} from "@/lib/reference-library.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/_app/biblioteca")({
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const list = useServerFn(listReferenceLibrary);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "product" | "prototype">("all");
  const [category, setCategory] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ref-library", search, source, category, season, collectionId, color],
    queryFn: () =>
      list({
        data: { search, source, category, season, collectionId, color, limit: 500 },
      }),
    staleTime: 60_000,
  });

  const heroes = useMemo(
    () =>
      (data?.items ?? [])
        .filter((i) => i.source === "product" && i.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3),
    [data],
  );

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Library className="size-6" /> Biblioteca de Referências
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo global de produtos e protótipos de todas as coleções. Use como base para novas referências.
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex gap-4">
          <span>
            <b className="text-foreground">{data?.totals.products ?? 0}</b> produtos
          </span>
          <span>
            <b className="text-foreground">{data?.totals.prototypes ?? 0}</b> protótipos
          </span>
        </div>
      </header>

      {heroes.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Sparkles className="size-4 text-primary" /> Heróis comerciais (180d) — candidatos a carry-over
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {heroes.map((h) => (
              <RefCard key={`hero-${h.id}`} item={h} highlight />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, nome, coleção…"
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={source}
          onValueChange={(v) => v && setSource(v as typeof source)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">Tudo</ToggleGroupItem>
          <ToggleGroupItem value="product">Produtos</ToggleGroupItem>
          <ToggleGroupItem value="prototype">Protótipos</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 space-y-4">
          <FacetGroup
            title="Categorias"
            value={category}
            onChange={setCategory}
            options={data?.facets.categories ?? []}
          />
          <FacetGroup
            title="Estação"
            value={season}
            onChange={setSeason}
            options={data?.facets.seasons ?? []}
          />
          <FacetGroup
            title="Coleção"
            value={collectionId}
            onChange={setCollectionId}
            options={(data?.facets.collections ?? []).map((c) => ({
              value: c.id,
              label: c.name,
              count: c.count,
            }))}
          />
          <FacetGroup
            title="Cor"
            value={color}
            onChange={setColor}
            options={data?.facets.colors ?? []}
          />
        </aside>

        <main className="col-span-12 md:col-span-9">
          {isLoading && (
            <div className="text-center text-muted-foreground py-12">Carregando…</div>
          )}
          {!isLoading && (data?.items.length ?? 0) === 0 && (
            <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
              Nenhuma referência encontrada.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(data?.items ?? []).map((it) => (
              <RefCard key={`${it.source}-${it.id}`} item={it} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function FacetGroup({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; count: number; label?: string }[];
}) {
  if (options.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-[10px] text-primary hover:underline"
          >
            limpar
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
            className={`w-full flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted/50 ${value === o.value ? "bg-primary/10 text-primary font-medium" : ""}`}
          >
            <span className="truncate">{o.label ?? o.value}</span>
            <span className="text-muted-foreground tabular-nums">{o.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RefCard({ item, highlight = false }: { item: RefItem; highlight?: boolean }) {
  const href =
    item.source === "product" ? `/produto/${item.id}` : `/dev-kanban`;
  return (
    <Link
      to={href}
      className={`group rounded-xl border bg-card overflow-hidden hover:shadow-md transition ${highlight ? "border-primary/40" : "border-border"}`}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge
            variant={item.source === "product" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {item.source === "product" ? "Produto" : "Protótipo"}
          </Badge>
          {item.stage && (
            <Badge variant="outline" className="text-[10px] bg-background/80">
              {item.stage}
            </Badge>
          )}
        </div>
        {item.revenue > 0 && (
          <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur rounded px-2 py-0.5 text-[10px] font-mono">
            {formatCurrency(item.revenue)}
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <div className="font-mono text-[10px] text-muted-foreground">{item.code}</div>
        <div className="text-xs font-medium line-clamp-2 leading-tight">{item.name}</div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate">{item.collectionName ?? "—"}</span>
          {item.season && <span>{item.season}</span>}
        </div>
        {item.colors.length > 0 && (
          <div className="flex gap-1 pt-1">
            {item.colors.slice(0, 5).map((c, i) => (
              <span
                key={i}
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function formatCurrency(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
