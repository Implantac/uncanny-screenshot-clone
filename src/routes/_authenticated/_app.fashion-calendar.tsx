import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Calendar, Package, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/fashion-calendar")({
  component: FashionCalendar,
});

type Col = {
  id: string;
  name: string;
  season: string;
  year: number;
  status: string;
  progress: number;
  launch_date: string | null;
  products: number;
};

async function load(): Promise<Col[]> {
  const [{ data: cols }, { data: prods }] = await Promise.all([
    supabase
      .from("collections")
      .select("id, name, season, year, status, progress, launch_date")
      .order("launch_date", { ascending: true, nullsFirst: false }),
    supabase.from("products").select("collection_id"),
  ]);
  const countByCol = new Map<string, number>();
  (prods ?? []).forEach((p) => {
    if (p.collection_id)
      countByCol.set(p.collection_id, (countByCol.get(p.collection_id) ?? 0) + 1);
  });
  return (cols ?? []).map((c) => ({ ...c, products: countByCol.get(c.id) ?? 0 }));
}

function FashionCalendar() {
  const { data, isLoading } = useQuery({
    queryKey: ["fashion-calendar"],
    queryFn: load,
  });
  const cols = useMemo(() => data ?? [], [data]);
  const today = useMemo(() => new Date(), []);

  const enriched = useMemo(
    () =>
      cols.map((c) => {
        const launch = c.launch_date ? new Date(c.launch_date) : null;
        const days = launch ? Math.ceil((launch.getTime() - today.getTime()) / 86400000) : null;
        const phase =
          c.status === "lancada" || c.status === "concluida"
            ? "lançada"
            : days != null && days < 0
              ? "atrasada"
              : days != null && days < 30
                ? "iminente"
                : days != null && days < 90
                  ? "produção"
                  : "desenvolvimento";
        return { ...c, days, phase };
      }),
    [cols, today],
  );

  const summary = useMemo(
    () => ({
      total: enriched.length,
      iminente: enriched.filter((c) => c.phase === "iminente").length,
      atrasada: enriched.filter((c) => c.phase === "atrasada").length,
      lancada: enriched.filter((c) => c.phase === "lançada").length,
    }),
    [enriched],
  );

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fashion Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Linha do tempo de coleções: desenvolvimento, produção, lançamento e sell-in.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Coleções" value={summary.total} icon={<Package className="size-4" />} />
        <KPI
          label="Lançamento iminente"
          value={summary.iminente}
          icon={<Clock className="size-4" />}
          tone="warning"
        />
        <KPI
          label="Atrasadas"
          value={summary.atrasada}
          icon={<AlertTriangle className="size-4" />}
          tone="destructive"
        />
        <KPI
          label="Lançadas"
          value={summary.lancada}
          icon={<CheckCircle2 className="size-4" />}
          tone="success"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 font-medium">
          <Calendar className="size-4 text-primary" /> Linha do tempo
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : enriched.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma coleção cadastrada.</div>
        ) : (
          <div className="divide-y divide-border">
            {enriched.map((c) => (
              <div key={c.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-12 md:col-span-4">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.season} {c.year} • {c.products} produtos
                  </div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.phase === "atrasada"
                        ? "bg-destructive/15 text-destructive"
                        : c.phase === "iminente"
                          ? "bg-warning/15 text-warning"
                          : c.phase === "lançada"
                            ? "bg-success/15 text-success"
                            : "bg-primary/15 text-primary"
                    }`}
                  >
                    {c.phase}
                  </span>
                </div>
                <div className="col-span-6 md:col-span-3 text-xs text-muted-foreground">
                  {c.launch_date ? new Date(c.launch_date).toLocaleDateString("pt-BR") : "sem data"}
                  {c.days != null && (
                    <span
                      className={`ml-2 ${c.days < 0 ? "text-destructive" : c.days < 30 ? "text-warning" : ""}`}
                    >
                      ({c.days < 0 ? `${Math.abs(c.days)}d atrás` : `em ${c.days}d`})
                    </span>
                  )}
                </div>
                <div className="col-span-12 md:col-span-3">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${c.progress}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{c.progress}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const tones = {
    default: "",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}
