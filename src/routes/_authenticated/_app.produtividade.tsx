import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Activity, Trophy, Clock, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  range: fallback(z.enum(["today", "7d", "30d", "custom"]), "7d").default("7d"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/_app/produtividade")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Produtividade · USE MODA OS" },
      { name: "description", content: "Ranking de passagens por operador com filtro de período." },
    ],
  }),
  component: Produtividade,
});

type Row = {
  id: string;
  created_by: string | null;
  quantity: number;
  qty_received: number | null;
  kind: string;
  to_stage: string;
  received_at: string | null;
  created_at: string;
};

const PRESETS: { v: "today" | "7d" | "30d"; label: string }[] = [
  { v: "today", label: "Hoje" },
  { v: "7d", label: "7 dias" },
  { v: "30d", label: "30 dias" },
];

function Produtividade() {
  useRealtime("service_orders", ["produtividade"]);
  const { range, from, to } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { fromISO, toISO, label } = useMemo(() => {
    const now = new Date();
    if (range === "custom" && from && to) {
      return {
        fromISO: new Date(from + "T00:00:00").toISOString(),
        toISO: new Date(to + "T23:59:59").toISOString(),
        label: `${format(new Date(from), "dd/MM")} → ${format(new Date(to), "dd/MM")}`,
      };
    }
    if (range === "today") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return { fromISO: d.toISOString(), toISO: now.toISOString(), label: "Hoje" };
    }
    const days = range === "30d" ? 30 : 7;
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return { fromISO: d.toISOString(), toISO: now.toISOString(), label: `Últimos ${days} dias` };
  }, [range, from, to]);

  const ordersQ = useQuery({
    queryKey: ["produtividade", fromISO, toISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id,created_by,quantity,qty_received,kind,to_stage,received_at,created_at")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .not("created_by", "is", null);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["produtividade-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,avatar_url");
      return data ?? [];
    },
  });

  const rows = ordersQ.data ?? [];
  const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);

  const agg = useMemo(() => {
    const m = new Map<
      string,
      {
        passagens: number;
        pcs: number;
        passagensHoje: number;
        pcsHoje: number;
        stages: Set<string>;
      }
    >();
    for (const r of rows) {
      const uid = r.created_by!;
      if (!m.has(uid))
        m.set(uid, { passagens: 0, pcs: 0, passagensHoje: 0, pcsHoje: 0, stages: new Set() });
      const x = m.get(uid)!;
      const qty = Number(r.qty_received ?? r.quantity ?? 0);
      x.passagens++;
      x.pcs += qty;
      x.stages.add(r.to_stage);
      if (r.created_at.slice(0, 10) === today) {
        x.passagensHoje++;
        x.pcsHoje += qty;
      }
    }
    return [...m.entries()]
      .map(([uid, v]) => ({ uid, ...v, stages: [...v.stages] }))
      .sort((a, b) => b.pcs - a.pcs);
  }, [rows, today]);

  const totaisHoje = agg.reduce((s, x) => ({ p: s.p + x.passagensHoje, pc: s.pc + x.pcsHoje }), {
    p: 0,
    pc: 0,
  });
  const totaisPeriodo = agg.reduce((s, x) => ({ p: s.p + x.passagens, pc: s.pc + x.pcs }), {
    p: 0,
    pc: 0,
  });
  const top = agg[0];

  const setPreset = (v: "today" | "7d" | "30d") =>
    navigate({ search: () => ({ range: v, from: "", to: "" }), replace: true });

  const setCustom = (d: { from?: Date; to?: Date } | undefined) => {
    if (!d?.from || !d?.to) return;
    navigate({
      search: () => ({
        range: "custom" as const,
        from: format(d.from!, "yyyy-MM-dd"),
        to: format(d.to!, "yyyy-MM-dd"),
      }),
      replace: true,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Activity className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Produtividade</h1>
            <p className="text-sm text-muted-foreground">
              Ranking de passagens por operador · {label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border">
          {PRESETS.map((p) => (
            <button
              key={p.v}
              onClick={() => setPreset(p.v)}
              className={cn(
                "px-3 h-8 rounded-md text-xs font-medium transition",
                range === p.v
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 gap-1.5 text-xs",
                  range === "custom" && "bg-background shadow-sm",
                )}
              >
                <CalendarIcon className="size-3.5" />
                {range === "custom" && from && to
                  ? `${format(new Date(from), "dd/MM")}–${format(new Date(to), "dd/MM")}`
                  : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={
                  range === "custom" && from && to
                    ? { from: new Date(from), to: new Date(to) }
                    : undefined
                }
                onSelect={setCustom}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Passagens no período</div>
          <div className="text-2xl font-semibold tabular-nums">{totaisPeriodo.p}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Peças passadas no período</div>
          <div className="text-2xl font-semibold tabular-nums">
            {totaisPeriodo.pc.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Operadores ativos</div>
          <div className="text-2xl font-semibold tabular-nums">{agg.length}</div>
        </div>
        <div className="glass rounded-xl p-5 border border-primary/30">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Trophy className="size-3" /> Top operador
          </div>
          <div className="text-base font-semibold truncate">
            {top ? (profMap.get(top.uid)?.full_name ?? "—") : "—"}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {top?.pcs.toLocaleString("pt-BR") ?? 0} pç
          </div>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Ranking · {label}</span>
        </div>
        {agg.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma passagem no período. Use o botão <span className="font-medium">Passar</span> nos
            kanbans.
            <div className="mt-3">
              <Link to="/pcp-kanban" className="text-primary hover:underline">
                Abrir PCP Kanban
              </Link>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">#</th>
                <th className="text-left font-medium px-5 py-2.5">Operador</th>
                <th className="text-right font-medium px-5 py-2.5">Hoje</th>
                <th className="text-right font-medium px-5 py-2.5">Período (pç)</th>
                <th className="text-right font-medium px-5 py-2.5">Passagens</th>
                <th className="text-left font-medium px-5 py-2.5">Setores</th>
              </tr>
            </thead>
            <tbody>
              {agg.map((x, i) => {
                const p = profMap.get(x.uid);
                return (
                  <tr key={x.uid} className="border-t border-border hover:bg-muted/30">
                    <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3 font-medium flex items-center gap-2">
                      {p?.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="size-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="size-6 rounded-full bg-muted grid place-items-center text-[10px]">
                          {(p?.full_name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      {p?.full_name ?? "Sem nome"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {x.pcsHoje.toLocaleString("pt-BR")}{" "}
                      <span className="text-xs text-muted-foreground">({x.passagensHoje})</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {x.pcs.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {x.passagens}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {x.stages.join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
