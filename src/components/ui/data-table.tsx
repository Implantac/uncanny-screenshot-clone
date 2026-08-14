import { useState, useMemo, useCallback, type ReactNode, type ComponentType } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  /** Chave única */
  key: string;
  /** Rótulo do cabeçalho */
  label?: ReactNode;
  /** Alias de label (compat) */
  header?: ReactNode;
  /** Renderizador customizado (fallback: row[key]) — método p/ ser bivariante */
  render?(row: T, idx: number): ReactNode;
  /** Alias de render (compat) */
  cell?(row: T, idx: number): ReactNode;
  /** Se é ordenável */
  sortable?: boolean;
  /** Largura (ex: "w-24") */
  className?: string;
  /** Alinhamento */
  align?: "left" | "center" | "right";
  /** Função para extrair valor ordenável (padrão: String(row[key])) */
  sortValue?(row: T): string | number;
  /** Alias de sortValue (compat) */
  value?(row: T): string | number;
  /** Ocultar no mobile */
  hideOnMobile?: boolean;
}

type SortDir = "asc" | "desc" | null;

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Chave única para cada linha */
  rowKey?(row: T): string;
  /** Alias de rowKey (compat) */
  getRowId?(row: T): string;
  /** Placeholder da busca */
  searchPlaceholder?: string;
  /** Callback de busca customizada */
  onSearch?(query: string, rows: T[]): T[];
  /** Classe extra */
  className?: string;
  /** Ações extras no toolbar */
  toolbar?: ReactNode;
  /** Estado vazio (legado) */
  emptyLabel?: string;
  /** Título do estado vazio */
  emptyTitle?: string;
  /** Descrição do estado vazio */
  emptyDescription?: string;
  /** Ícone do estado vazio */
  emptyIcon?: ComponentType<{ className?: string }>;
  /** Ordenação inicial */
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Estado de carregamento */
  loading?: boolean;
  /** Paginação */
  pageSize?: number;
  /** Callback ao clicar na linha */
  onRowClick?(row: T): void;
}

/**
 * DataTable — Wrapper padronizado sobre Table do shadcn/ui
 * com busca, ordenação, paginação e responsividade.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  getRowId,
  searchPlaceholder = "Buscar…",
  onSearch,
  className,
  toolbar,
  emptyLabel,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
  initialSort,
  loading,
  pageSize = 25,
  onRowClick,
}: DataTableProps<T>) {
  const keyFor =
    rowKey ??
    getRowId ??
    ((row: T) => String((row as Record<string, unknown>).id ?? Math.random()));
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initialSort?.dir ?? null);
  const [page, setPage] = useState(0);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDir === "asc") {
          setSortDir("desc");
        } else if (sortDir === "desc") {
          setSortKey(null);
          setSortDir(null);
        }
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
      setPage(0);
    },
    [sortKey, sortDir],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    if (onSearch) return onSearch(query.trim(), data);
    const q = query.toLowerCase();
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((v) => {
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [data, query, onSearch]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const sv = col.sortValue ?? col.value;
      const aVal = sv ? sv(a) : String((a as Record<string, unknown>)[sortKey] ?? "");
      const bVal = sv ? sv(b) : String((b as Record<string, unknown>)[sortKey] ?? "");
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "pt-BR", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="size-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="size-3 text-primary" />
    ) : (
      <ArrowDown className="size-3 text-primary" />
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 text-xs"
          />
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        {query && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} de {data.length}
          </span>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground animate-pulse">
          Carregando…
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {EmptyIcon && <EmptyIcon className="size-8 mx-auto mb-2 opacity-50" />}
          {emptyTitle && <div className="font-medium text-foreground">{emptyTitle}</div>}
          {emptyDescription ?? emptyLabel ?? "Nenhum resultado encontrado."}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      col.className,
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.hideOnMobile && "hidden md:table-cell",
                      col.sortable && "cursor-pointer select-none hover:bg-muted/50",
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label ?? col.header}
                      {col.sortable && <SortIcon colKey={col.key} />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row, idx) => (
                <TableRow
                  key={keyFor(row)}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => {
                    const renderer = col.render ?? col.cell;
                    return (
                      <TableCell
                        key={`${keyFor(row)}-${col.key}`}
                        className={cn(
                          col.className,
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                          col.hideOnMobile && "hidden md:table-cell",
                        )}
                      >
                        {renderer
                          ? renderer(row, idx)
                          : (((row as Record<string, unknown>)[col.key] as ReactNode) ?? "—")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {safePage + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
              <Button
                key={i}
                size="icon"
                variant={i === safePage ? "default" : "ghost"}
                className="size-7 text-[11px]"
                onClick={() => setPage(i)}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
