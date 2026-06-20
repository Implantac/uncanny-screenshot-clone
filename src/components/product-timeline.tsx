import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";

type Event = {
  id: string;
  at: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: "default" | "primary" | "success" | "warning";
};

type ProtoRow = {
  id: string;
  code: string;
  name: string | null;
  stage: string;
  created_at: string;
  updated_at: string | null;
};
type SheetRow = {
  id: string;
  version: number | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};
type FitRow = {
  id: string;
  title: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
};
type OpRow = {
  id: string;
  code: string;
  stage: string;
  status: string;
  quantity: number | null;
  created_at: string;
};
type LogRow = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  quantity: number | null;
  is_partial: boolean | null;
  created_at: string;
  production_orders: { code: string | null; product_id: string | null } | null;
};

async function loadEvents(productId: string, createdAt: string): Promise<Event[]> {
  const [protos, fits, sheets, ops, logs] = await Promise.all([
    supabase
      .from("prototypes")
      .select("id, code, name, stage, created_at, updated_at")
      .eq("product_id", productId),
    supabase
      .from("fit_sessions")
      .select("id, title, status, scheduled_at, created_at")
      .eq("product_id", productId),
    supabase
      .from("tech_sheets")
      .select("id, version, status, updated_at, created_at")
      .eq("product_id", productId),
    supabase
      .from("production_orders")
      .select("id, code, stage, status, quantity, created_at")
      .eq("product_id", productId),
    supabase
      .from("production_stage_log")
      .select(
        "id, from_stage, to_stage, quantity, is_partial, created_at, production_orders!inner(product_id, code)",
      )
      .eq("production_orders.product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const ev: Event[] = [];
  ev.push({
    id: `created-${productId}`,
    at: createdAt,
    icon: <Package className="size-3.5" />,
    title: "Produto criado",
    tone: "default",
  });
  (protos.data ?? []).forEach((p: ProtoRow) => {
    ev.push({
      id: `proto-${p.id}`,
      at: p.updated_at ?? p.created_at,
      icon: <Sparkles className="size-3.5" />,
      title: `Protótipo ${p.code} · ${p.stage}`,
      detail: p.name ?? undefined,
      tone: p.stage === "aprovado" ? "success" : "primary",
    });
  });
  (sheets.data ?? []).forEach((s: SheetRow) => {
    ev.push({
      id: `sheet-${s.id}`,
      at: s.updated_at ?? s.created_at,
      icon: <FileText className="size-3.5" />,
      title: `Ficha técnica v${s.version} · ${s.status}`,
      tone: s.status === "aprovada" ? "success" : "default",
    });
  });
  (fits.data ?? []).forEach((f: FitRow) => {
    ev.push({
      id: `fit-${f.id}`,
      at: f.scheduled_at ?? f.created_at,
      icon: <Ruler className="size-3.5" />,
      title: `Prova de modelagem · ${f.status}`,
      detail: f.title ?? undefined,
      tone: "primary",
    });
  });
  (ops.data ?? []).forEach((o: OpRow) => {
    ev.push({
      id: `op-${o.id}`,
      at: o.created_at,
      icon: <Factory className="size-3.5" />,
      title: `OP ${o.code} aberta (${o.quantity} pç)`,
      detail: `Estágio ${o.stage} · ${o.status}`,
      tone: "primary",
    });
  });
  (logs.data ?? []).forEach((l: LogRow) => {
    ev.push({
      id: `log-${l.id}`,
      at: l.created_at,
      icon: l.is_partial ? (
        <Scissors className="size-3.5" />
      ) : (
        <CheckCircle2 className="size-3.5" />
      ),
      title: `${l.production_orders?.code ?? "OP"}: ${l.from_stage ?? "—"} → ${l.to_stage}`,
      detail: `${l.is_partial ? "Parcial" : "Integral"}${l.quantity ? ` · ${l.quantity} pç` : ""}`,
      tone: l.is_partial ? "warning" : "success",
    });
  });

  return ev
    .filter((e) => !!e.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);
}

export function ProductTimeline({
  productId,
  createdAt,
}: {
  productId: string;
  createdAt: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-timeline", productId],
    queryFn: () => loadEvents(productId, createdAt),
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" /> Timeline do produto
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Versões, provas, fichas, protótipos e passagens de produção em uma única linha.
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Carregando histórico…
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sem eventos registrados ainda.</div>
      ) : (
        <ol className="relative border-l border-border ml-2 pl-4 space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {data.map((e) => {
            const tone =
              e.tone === "success"
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                : e.tone === "warning"
                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  : e.tone === "primary"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border";
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[1.4rem] top-0.5 size-5 rounded-full grid place-items-center border ${tone}`}
                >
                  {e.icon}
                </span>
                <div className="text-sm font-medium leading-tight">{e.title}</div>
                {e.detail && <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  {new Date(e.at).toLocaleString("pt-BR")}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
