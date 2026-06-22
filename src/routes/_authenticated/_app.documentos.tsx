import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Palette,
  Search,
  ShoppingBag,
  Ruler,
  Warehouse,
} from "lucide-react";
import { listDocumentsHub, type DocItem, type DocSource } from "@/lib/documents-hub.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/_app/documentos")({
  component: DocumentsHub,
});

const SOURCE_META: Record<
  DocSource,
  { label: string; icon: typeof FileText; tint: string }
> = {
  tech_sheet: {
    label: "Ficha técnica",
    icon: Ruler,
    tint: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  supplier_portal: {
    label: "Portal fornecedor",
    icon: Warehouse,
    tint: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  },
  collection_cover: {
    label: "Capa de coleção",
    icon: Palette,
    tint: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30",
  },
  collection_moodboard: {
    label: "Moodboard",
    icon: Megaphone,
    tint: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  },
  product_image: {
    label: "Foto produto",
    icon: ShoppingBag,
    tint: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
};

function formatBytes(n: number | null) {
  if (!n || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocCard({ item }: { item: DocItem }) {
  const meta = SOURCE_META[item.source];
  const Icon = meta.icon;
  const size = formatBytes(item.size);
  return (
    <div className="glass rounded-xl overflow-hidden border border-border hover:border-primary/40 transition group">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="block aspect-square bg-muted/30 relative overflow-hidden"
      >
        {item.isImage ? (
          <img
            src={item.url}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover group-hover:scale-105 transition"
          />
        ) : item.isPdf ? (
          <div className="size-full grid place-items-center text-destructive">
            <FileText className="size-12" />
          </div>
        ) : (
          <div className="size-full grid place-items-center text-muted-foreground">
            <FileText className="size-12" />
          </div>
        )}
        <span
          className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${meta.tint}`}
        >
          <Icon className="size-3" />
          {meta.label}
        </span>
      </a>
      <div className="p-3 space-y-1">
        <div className="text-xs font-semibold line-clamp-1" title={item.title}>
          {item.title}
        </div>
        {item.subtitle && (
          <div className="text-[11px] text-muted-foreground line-clamp-1">{item.subtitle}</div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString("pt-BR")}
            {size ? ` · ${size}` : ""}
          </span>
          {item.link && (
            <Link
              to={item.link}
              className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              Abrir <ExternalLink className="size-2.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentsHub() {
  const fn = useServerFn(listDocumentsHub);
  const [sources, setSources] = useState<DocSource[]>([]);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["documents-hub", sources, search],
    queryFn: () =>
      fn({
        data: {
          sources: sources.length ? sources : undefined,
          search: search || undefined,
          limit: 240,
        },
      }),
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const counts = data?.counts;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold inline-flex items-center gap-2">
            <FolderOpen className="size-5 text-primary" />
            Central de Documentos
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tudo num só lugar: fichas técnicas, anexos do portal de fornecedor, capas, moodboards e
            fotos de produto.
          </p>
        </div>
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          {isLoading && <Loader2 className="size-3 animate-spin" />}
          {data && <span>{data.total} documento(s)</span>}
        </div>
      </header>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, SKU, fornecedor, coleção…"
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="multiple"
          value={sources}
          onValueChange={(v) => setSources(v as DocSource[])}
          className="flex flex-wrap justify-start"
        >
          {(Object.keys(SOURCE_META) as DocSource[]).map((s) => {
            const m = SOURCE_META[s];
            const Icon = m.icon;
            return (
              <ToggleGroupItem key={s} value={s} className="text-xs gap-1.5">
                <Icon className="size-3" />
                {m.label}
                {counts && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                    {counts[s]}
                  </Badge>
                )}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2 p-8">
          <Loader2 className="size-4 animate-spin" /> Carregando documentos…
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">
          <ImageIcon className="size-8 mx-auto mb-2 opacity-40" />
          Nenhum documento encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map((it) => (
            <DocCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
