import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Activity, Trophy, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/_app/produtividade")({
  head: () => ({
    meta: [
      { title: "Produtividade · USE MODA OS" },
      { name: "description", content: "Ranking de passagens por operador (hoje e 7 dias)." },
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

function Produtividade() {
  useRealtime("service_orders", ["produtividade"]);

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const ordersQ = useQuery({
    queryKey: ["produtividade", sevenDaysAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id,created_by,quantity,qty_received,kind,to_stage,received_at,created_at")
        .gte("created_at", sevenDaysAgo)
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
    const m = new Map<string, { passagens: number; pcs: number; passagensHoje: number; pcsHoje: number; stages: Set<string> }>();
    for (const r of rows) {
      const uid = r.created_by!;
      if (!m.has(uid)) m.set(uid, { passagens: 0, pcs: 0, passagensHoje: 0, pcsHoje: 0, stages: new Set() });
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

  const totaisHoje = agg.reduce((s, x) => ({ p: s.p + x.passagensHoje, pc: s.pc + x.pcsHoje }), { p: 0, pc: 0 });
  const top = agg[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Activity className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtividade</h1>
          <p className="text-sm text-muted-foreground">Ranking de passagens por operador · últimos 7 dias</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Passagens hoje</div>
          <div className="text-2xl font-semibold tabular-nums">{totaisHoje.p}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Peças passadas hoje</div>
          <div className="text-2xl font-semibold tabular-nums">{totaisHoje.pc.toLocaleString("pt-BR")}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Operadores ativos (7d)</div>
          <div className="text-2xl font-semibold tabular-nums">{agg.length}</div>
        </div>
        <div className="glass rounded-xl p-5 border border-primary/30">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="size-3" /> Top operador (7d)</div>
          <div className="text-base font-semibold truncate">{top ? (profMap.get(top.uid)?.full_name ?? "—") : "—"}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{top?.pcs.toLocaleString("pt-BR") ?? 0} pç</div>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Ranking 7 dias</span>
        </div>
        {agg.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma passagem registrada. Use o botão <span className="font-medium">Passar</span> nos kanbans para começar.
            <div className="mt-3"><Link to="/pcp-kanban" className="text-primary hover:underline">Abrir PCP Kanban</Link></div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">#</th>
                <th className="text-left font-medium px-5 py-2.5">Operador</th>
                <th className="text-right font-medium px-5 py-2.5">Hoje</th>
                <th className="text-right font-medium px-5 py-2.5">7 dias (pç)</th>
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
                        <img src={p.avatar_url} alt="" className="size-6 rounded-full object-cover" />
                      ) : (
                        <div className="size-6 rounded-full bg-muted grid place-items-center text-[10px]">{(p?.full_name ?? "?").slice(0, 1).toUpperCase()}</div>
                      )}
                      {p?.full_name ?? "Sem nome"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{x.pcsHoje.toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground">({x.passagensHoje})</span></td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">{x.pcs.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{x.passagens}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{x.stages.join(", ")}</td>
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
