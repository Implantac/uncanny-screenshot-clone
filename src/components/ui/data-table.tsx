import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, type LucideIcon } from "lucide-react";
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
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * Sprint C — DataTable unificada.
 *
 * Componente único para listagens tabulares no PLM: sort por coluna,
 * busca global, sticky header, skeleton e empty state integrados.
 * Mantém o visual dos badges/StatusBadge — apenas normaliza a moldura.
 */
export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Valor para sort/busca. Se omitido, coluna não é sortable/buscável. */
  value?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
};

type Props<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  className?: string;
  stickyHeader?: boolean;
  pageSize?: number;
};

export function DataTable<T>({
  data,
  columns,
  loading,
  getRowId,
  onRowClick,
  emptyTitle = "Nenhum resultado",
  emptyDescription = "Ajuste os filtros ou tente outra busca.",
  emptyIcon,
  searchPlaceholder = "Buscar…",
  toolbar,
  initialSort,
  className,
  stickyHeader = true,
  pageSize,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    const searchable = columns.filter((c) => c.value);
    return data.filter((row) =>
      searchable.some((c) => {
        const v = c.value?.(row);
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.value) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const paged = pageSize ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted;

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.value || col.sortable === false) return;
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="pl-8 h-9"
          />
        </div>
        {toolbar}
        <div className="ml-auto text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "item" : "itens"}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} columns={Math.min(columns.length, 6)} />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader
                className={cn(stickyHeader && "sticky top-0 bg-card/95 backdrop-blur z-10")}
              >
                <TableRow>
                  {columns.map((c) => {
                    const active = sort?.key === c.key;
                    const canSort = !!c.value && c.sortable !== false;
                    return (
                      <TableHead
                        key={c.key}
                        className={cn(
                          c.headerClassName,
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          canSort && "cursor-pointer select-none",
                        )}
                        onClick={canSort ? () => toggleSort(c.key) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.header}
                          {canSort &&
                            (active ? (
                              sort!.dir === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 opacity-30" />
                            ))}
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer hover:bg-muted/40")}
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          c.className,
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                        )}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {pageSize && pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page + 1} de {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
