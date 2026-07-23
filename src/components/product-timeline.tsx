import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  Scissors,
  FileText,
  Ruler,
  Factory,
  CheckCircle2,
  MessageSquare,
  Loader2,
  Package,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  History,
  UserCheck,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EventRow = {
  event_id: string;
  product_id: string;
  occurred_at: string;
  source: string;
  event_type: string;
  title: string;
  detail: string | null;
  severity: "default" | "primary" | "success" | "warning" | "danger" | string;
  ref_table: string | null;
  ref_id: string | null;
  actor_email: string | null;
};

const SOURCE_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  product: { label: "Produto", icon: <Package className="size-3.5" /> },
  prototype: { label: "Protótipo", icon: <Sparkles className="size-3.5" /> },
  prototype_gate: {
    label: "Gate",
    icon: <ShieldCheck className="size-3.5" />,
  },
  tech_sheet: { label: "Ficha", icon: <FileText className="size-3.5" /> },
  tech_sheet_version: {
    label: "Versão",
    icon: <History className="size-3.5" />,
  },
  fit_session: { label: "Prova", icon: <Ruler className="size-3.5" /> },
  production_order: { label: "OP", icon: <Factory className="size-3.5" /> },
  production_stage_log: {
    label: "Passagem",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  production_occurrence: {
    label: "Ocorrência",
    icon: <AlertTriangle className="size-3.5" />,
  },
  quality_inspection: {
    label: "Qualidade",
    icon: <ShieldCheck className="size-3.5" />,
  },
  quality_capa: {
    label: "CAPA",
    icon: <ShieldAlert className="size-3.5" />,
  },
  audit: { label: "Auditoria", icon: <UserCheck className="size-3.5" /> },
};

function iconFor(row: EventRow) {
  if (row.source === "production_stage_log" && row.event_type.includes("stage")) {
    return row.detail?.startsWith("Parcial") ? (
      <Scissors className="size-3.5" />
    ) : (
      <CheckCircle2 className="size-3.5" />
    );
  }
  return SOURCE_META[row.source]?.icon ?? <MessageSquare className="size-3.5" />;
}

function toneClass(severity: string) {
  switch (severity) {
    case "success":
      return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "warning":
      return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "danger":
      return "bg-rose-500/15 text-rose-600 border-rose-500/30";
    case "primary":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const PAGE_SIZE = 100;

export function ProductTimeline({ productId }: { productId: string; createdAt?: string }) {
  const [filter, setFilter] = useState<string>("all");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);


  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["v-product-events", productId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("v_product_events")
        .select(
          "event_id, product_id, occurred_at, source, event_type, title, detail, severity, ref_table, ref_id, actor_email",
        )
        .eq("product_id", productId)
        .order("occurred_at", { ascending: false })
        .order("event_id", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt("occurred_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    getNextPageParam: (last) =>
      last.length < PAGE_SIZE ? undefined : last[last.length - 1]?.occurred_at ?? undefined,
    staleTime: 30_000,
  });

  const all = useMemo<EventRow[]>(
    () => (data?.pages ?? []).flat(),
    [data],
  );

  const sources = useMemo(() => {
    const set = new Set<string>();
    all.forEach((e) => set.add(e.source));
    return Array.from(set);
  }, [all]);

  const filtered = useMemo(
    () => (filter === "all" ? all : all.filter((e) => e.source === filter)),
    [all, filter],
  );

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    overscan: 8,
    getItemKey: (i) => filtered[i]?.event_id ?? i,
  });

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, filter, filtered.length]);


  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" /> Timeline unificada
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Um só fluxo com engenharia, protótipos, PCP, qualidade e auditoria.
          </div>
        </div>
        <div className="flex items-center gap-2">
          {all.length > 0 && (
            <Badge variant="outline" className="font-mono">
              {filtered.length}/{all.length}
              {hasNextPage ? "+" : ""}
            </Badge>
          )}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <Filter className="size-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_META[s]?.label ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Carregando histórico…
        </div>
      ) : error ? (
        <div className="text-xs text-destructive">
          Não foi possível carregar a timeline.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Sem eventos registrados ainda.
        </div>
      ) : (
        <ol className="relative border-l border-border ml-2 pl-4 space-y-3 max-h-[560px] overflow-y-auto pr-1">
          {filtered.map((e) => {
            const tone = toneClass(e.severity);
            const meta = SOURCE_META[e.source];
            return (
              <li key={e.event_id} className="relative">
                <span
                  className={`absolute -left-[1.4rem] top-0.5 size-5 rounded-full grid place-items-center border ${tone}`}
                >
                  {iconFor(e)}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="text-sm font-medium leading-tight">{e.title}</div>
                  {meta && (
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      {meta.label}
                    </Badge>
                  )}
                </div>
                {e.detail && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {e.detail}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono flex items-center gap-2">
                  {new Date(e.occurred_at).toLocaleString("pt-BR")}
                  {e.actor_email && <span>· {e.actor_email}</span>}
                </div>
              </li>
            );
          })}

          <li className="pt-2">
            <div ref={sentinelRef} />
            {hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1.5" /> Carregando…
                  </>
                ) : (
                  "Carregar mais eventos"
                )}
              </Button>
            ) : (
              <div className="text-[10px] text-muted-foreground text-center">
                Fim do histórico
              </div>
            )}
          </li>
        </ol>
      )}
    </div>
  );
}
