import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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

export function ProductTimeline({ productId }: { productId: string; createdAt?: string }) {
  const [filter, setFilter] = useState<string>("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["v-product-events", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_product_events")
        .select(
          "event_id, product_id, occurred_at, source, event_type, title, detail, severity, ref_table, ref_id, actor_email",
        )
        .eq("product_id", productId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    staleTime: 30_000,
  });

  const sources = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((e) => set.add(e.source));
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(
    () => (filter === "all" ? data ?? [] : (data ?? []).filter((e) => e.source === filter)),
    [data, filter],
  );

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
          {data && (
            <Badge variant="outline" className="font-mono">
              {filtered.length}/{data.length}
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
        </ol>
      )}
    </div>
  );
}
