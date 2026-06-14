import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { Megaphone, Calendar, Plus, Trash2, Pencil, Sparkles, Download, TrendingUp, TrendingDown, Target, DollarSign, Activity, Award, AlertTriangle, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, ScatterChart, Scatter, ZAxis, ReferenceLine, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { exportToCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing · USE MODA OS" },
      { name: "description", content: "Campanhas e performance de mídia." },
    ],
  }),
  component: Marketing,
});

type CStatus = "programada" | "ativa" | "pausada" | "concluida";
type Campaign = {
  id: string; owner_id: string; name: string; channel: string | null;
  start_date: string | null; end_date: string | null;
  investment: number; roas: number; status: CStatus; notes: string | null;
};

const STATUS_LABEL: Record<CStatus, string> = {
  programada: "Programada", ativa: "Ativa", pausada: "Pausada", concluida: "Concluída",
};
const STATUS_STYLE: Record<CStatus, string> = {
  programada: "bg-sky-500/15 text-sky-400",
  ativa: "bg-emerald-500/15 text-emerald-400",
  pausada: "bg-amber-500/15 text-amber-400",
  concluida: "bg-muted text-muted-foreground",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function Marketing() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("marketing_campaigns", ["marketing_campaigns"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("todos");
  const [periodFilter, setPeriodFilter] = useState<"30" | "90" | "365" | "todos">("todos");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["marketing_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing_campaigns"] }); toast.success("Campanha removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const channels = useMemo(() => Array.from(new Set(rows.map((c) => c.channel).filter(Boolean) as string[])), [rows]);
  const periodFiltered = useMemo(() => {
    if (periodFilter === "todos") return rows;
    const days = Number(periodFilter);
    const cutoff = Date.now() - days * 86400_000;
    return rows.filter((c) => c.start_date && new Date(c.start_date).getTime() >= cutoff);
  }, [rows, periodFilter]);
  const filtered = useMemo(() => channelFilter === "todos" ? periodFiltered : periodFiltered.filter((c) => c.channel === channelFilter), [periodFiltered, channelFilter]);
  const ativas = filtered.filter((c) => c.status === "ativa").length;
  const invTotal = filtered.reduce((a, b) => a + Number(b.investment), 0);
  const receitaEst = filtered.reduce((a, b) => a + Number(b.investment) * Number(b.roas), 0);
  const roasAvg = filtered.length ? filtered.reduce((a, b) => a + Number(b.roas), 0) / filtered.length : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Megaphone className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
            <p className="text-sm text-muted-foreground">Campanhas e calendário editorial</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!filtered.length} onClick={() => exportToCsv("marketing", filtered.map((c) => ({ ...c, status: STATUS_LABEL[c.status], receita_est: Number(c.investment) * Number(c.roas) })), [
            { key: "name", label: "Campanha" }, { key: "channel", label: "Canal" },
            { key: "start_date", label: "Início" }, { key: "end_date", label: "Fim" },
            { key: "investment", label: "Investimento" }, { key: "roas", label: "ROAS" },
            { key: "receita_est", label: "Receita estimada" }, { key: "status", label: "Status" },
          ])} className="gap-2"><Download className="size-4" />CSV</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Nova campanha
          </Button>
        </div>
      </div>

      <KpiGrid ativas={ativas} total={filtered.length} invTotal={invTotal} receitaEst={receitaEst} roasAvg={roasAvg} />

      <InsightsBar rows={filtered} invTotal={invTotal} receitaEst={receitaEst} roasAvg={roasAvg} />

      <ChartsSection rows={filtered} />


      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Período</span>
        {([
          { k: "30", label: "30 dias" },
          { k: "90", label: "90 dias" },
          { k: "365", label: "12 meses" },
          { k: "todos", label: "Tudo" },
        ] as const).map((p) => (
          <button key={p.k} onClick={() => setPeriodFilter(p.k)} className={`px-3 py-1 rounded-full text-xs border transition-colors ${periodFilter === p.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{p.label}</button>
        ))}
        {channels.length > 0 && <span className="text-[11px] uppercase tracking-wider text-muted-foreground ml-3 mr-1">Canal</span>}
        {channels.length > 0 && (
          <>
            <button onClick={() => setChannelFilter("todos")} className={`px-3 py-1 rounded-full text-xs border transition-colors ${channelFilter === "todos" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>Todos</button>
            {channels.map((ch) => (
              <button key={ch} onClick={() => setChannelFilter(ch)} className={`px-3 py-1 rounded-full text-xs border transition-colors ${channelFilter === ch ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{ch}</button>
            ))}
          </>
        )}
      </div>

      <AdvancedSection rows={filtered} />


      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Sem campanhas</h3>
          <p className="text-sm text-muted-foreground mb-4">{rows.length === 0 ? "Crie a primeira campanha." : "Nenhuma campanha no canal selecionado."}</p>
          {rows.length === 0 && <Button onClick={() => { setEditing(null); setOpen(true); }}>Nova campanha</Button>}
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border text-sm font-semibold inline-flex items-center gap-2"><Calendar className="size-4" /> Campanhas</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Campanha</th>
                  <th className="text-left font-medium px-5 py-2.5">Canal</th>
                  <th className="text-left font-medium px-5 py-2.5">Período</th>
                  <th className="text-right font-medium px-5 py-2.5">Investimento</th>
                  <th className="text-right font-medium px-5 py-2.5">ROAS</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const mine = c.owner_id === user?.id;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.channel || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">{fmt(c.start_date)} → {fmt(c.end_date)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{brl(Number(c.investment))}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">{Number(c.roas) > 0 ? `${Number(c.roas).toFixed(1)}x` : "—"}</td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td className="px-5 py-3 text-right">
                        {mine && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditing(c); setOpen(true); }} className="size-7 grid place-items-center rounded hover:bg-muted">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => confirm("Remover esta campanha?") && deleteMut.mutate(c.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CampaignDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function CampaignDialog({ open, onOpenChange, editing, userId }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Campaign | null; userId?: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [investment, setInvestment] = useState("0");
  const [roas, setRoas] = useState("0");
  const [status, setStatus] = useState<CStatus>("programada");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && editing) {
      setName(editing.name); setChannel(editing.channel || "");
      setStartDate(editing.start_date?.slice(0, 10) || "");
      setEndDate(editing.end_date?.slice(0, 10) || "");
      setInvestment(String(editing.investment)); setRoas(String(editing.roas));
      setStatus(editing.status); setNotes(editing.notes || "");
    } else if (open) {
      setName(""); setChannel(""); setStartDate(""); setEndDate("");
      setInvestment("0"); setRoas("0"); setStatus("programada"); setNotes("");
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        name, channel: channel || null,
        start_date: startDate || null, end_date: endDate || null,
        investment: Number(investment), roas: Number(roas),
        status, notes: notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("marketing_campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_campaigns").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_campaigns"] });
      toast.success(editing ? "Campanha atualizada" : "Campanha criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          <DialogDescription>Planejamento e performance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Canal</Label><Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Meta + Google" /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as CStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Investimento (R$)</Label><Input type="number" step="0.01" value={investment} onChange={(e) => setInvestment(e.target.value)} /></div>
            <div className="space-y-2"><Label>ROAS</Label><Input type="number" step="0.1" value={roas} onChange={(e) => setRoas(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const CHART_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];
const STATUS_COLORS: Record<CStatus, string> = {
  programada: "#0ea5e9", ativa: "#10b981", pausada: "#f59e0b", concluida: "#64748b",
};

function KpiCard({ icon: Icon, label, value, accent, hint, trend }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string;
  accent?: string; hint?: string; trend?: { dir: "up" | "down"; pct: number };
}) {
  return (
    <div className="glass rounded-xl p-5 relative overflow-hidden group hover:border-primary/40 transition-colors">
      <div className="absolute -right-6 -top-6 size-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ background: accent ?? "hsl(var(--primary))" }} />
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Icon className="size-3.5" />{label}</div>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${trend.dir === "up" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
            {trend.dir === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend.pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold mt-2 tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function KpiGrid({ ativas, total, invTotal, receitaEst, roasAvg }: {
  ativas: number; total: number; invTotal: number; receitaEst: number; roasAvg: number;
}) {
  const lucro = receitaEst - invTotal;
  const margemPct = invTotal > 0 ? (lucro / invTotal) * 100 : 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard icon={Activity} label="Campanhas ativas" value={String(ativas)} hint={`${total} no total`} />
      <KpiCard icon={DollarSign} label="Investimento" value={brl(invTotal)} />
      <KpiCard icon={TrendingUp} label="Receita estimada" value={brl(receitaEst)} accent="#10b981" />
      <KpiCard icon={Award} label="Lucro projetado" value={brl(lucro)} accent={lucro >= 0 ? "#10b981" : "#ef4444"} trend={{ dir: lucro >= 0 ? "up" : "down", pct: Math.abs(margemPct) }} />
      <KpiCard icon={Target} label="ROAS médio" value={`${roasAvg.toFixed(2)}x`} hint={roasAvg >= 3 ? "Excelente" : roasAvg >= 2 ? "Saudável" : "Atenção"} accent={roasAvg >= 3 ? "#10b981" : roasAvg >= 2 ? "#f59e0b" : "#ef4444"} />
    </div>
  );
}

function InsightsBar({ rows, invTotal, receitaEst, roasAvg }: {
  rows: Campaign[]; invTotal: number; receitaEst: number; roasAvg: number;
}) {
  const insights = useMemo(() => {
    const list: Array<{ icon: React.ComponentType<{ className?: string }>; tone: string; text: string }> = [];
    if (rows.length === 0) return list;
    const best = [...rows].filter((c) => Number(c.roas) > 0).sort((a, b) => Number(b.roas) - Number(a.roas))[0];
    const worst = [...rows].filter((c) => Number(c.roas) > 0).sort((a, b) => Number(a.roas) - Number(b.roas))[0];
    if (best) list.push({ icon: Zap, tone: "text-emerald-400 bg-emerald-500/10", text: `Melhor ROAS: ${best.name} (${Number(best.roas).toFixed(1)}x)` });
    if (worst && worst.id !== best?.id && Number(worst.roas) < 2) list.push({ icon: AlertTriangle, tone: "text-amber-400 bg-amber-500/10", text: `Revisar: ${worst.name} (${Number(worst.roas).toFixed(1)}x)` });
    if (roasAvg >= 3) list.push({ icon: Award, tone: "text-emerald-400 bg-emerald-500/10", text: `Carteira performando acima do mercado (${roasAvg.toFixed(1)}x)` });
    else if (roasAvg < 2 && invTotal > 0) list.push({ icon: AlertTriangle, tone: "text-rose-400 bg-rose-500/10", text: `ROAS médio abaixo de 2x — otimizar criativos` });
    const lucro = receitaEst - invTotal;
    if (lucro > 0 && invTotal > 0) list.push({ icon: TrendingUp, tone: "text-sky-400 bg-sky-500/10", text: `Margem projetada de ${((lucro / invTotal) * 100).toFixed(0)}% sobre investimento` });
    return list.slice(0, 4);
  }, [rows, invTotal, receitaEst, roasAvg]);

  if (insights.length === 0) return null;
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs font-semibold inline-flex items-center gap-1.5 mb-3 text-muted-foreground"><Sparkles className="size-3.5 text-primary" />Insights inteligentes</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {insights.map((i, idx) => (
          <div key={idx} className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${i.tone}`}>
            <i.icon className="size-4 mt-0.5 shrink-0" />
            <span className="leading-snug">{i.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function ChartsSection({ rows }: { rows: Campaign[] }) {
  const byChannel = useMemo(() => {
    const m = new Map<string, { channel: string; investimento: number; receita: number }>();
    rows.forEach((c) => {
      const k = c.channel || "Sem canal";
      const cur = m.get(k) ?? { channel: k, investimento: 0, receita: 0 };
      const inv = Number(c.investment);
      cur.investimento += inv;
      cur.receita += inv * Number(c.roas);
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.investimento - a.investimento);
  }, [rows]);

  const byStatus = useMemo(() => {
    const m = new Map<CStatus, number>();
    rows.forEach((c) => m.set(c.status, (m.get(c.status) ?? 0) + 1));
    return Array.from(m.entries()).map(([status, value]) => ({ name: STATUS_LABEL[status], value, status }));
  }, [rows]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { mes: string; investimento: number; receita: number }>();
    rows.forEach((c) => {
      if (!c.start_date) return;
      const d = new Date(c.start_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = m.get(key) ?? { mes: key, investimento: 0, receita: 0 };
      const inv = Number(c.investment);
      cur.investimento += inv;
      cur.receita += inv * Number(c.roas);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [rows]);

  const topCampaigns = useMemo(() =>
    [...rows]
      .filter((c) => Number(c.roas) > 0)
      .sort((a, b) => (Number(b.investment) * Number(b.roas)) - (Number(a.investment) * Number(a.roas)))
      .slice(0, 5)
      .map((c) => ({
        name: c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name,
        roas: Number(c.roas),
        receita: Number(c.investment) * Number(c.roas),
        investimento: Number(c.investment),
      })),
  [rows]);

  if (rows.length === 0) return null;

  const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="glass rounded-xl p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Evolução mensal</div>
          <div className="text-[11px] text-muted-foreground">Investimento vs. receita estimada</div>
        </div>
        {byMonth.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-16">Sem datas de início informadas.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={byMonth}>
              <defs>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="investimento" stroke="#3b82f6" strokeWidth={2} fill="url(#gInv)" name="Investimento" />
              <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} fill="url(#gRec)" name="Receita est." />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-4">Status das campanhas</div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
              {byStatus.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-5 lg:col-span-2">
        <div className="text-sm font-semibold mb-4">Investimento × Receita por canal</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byChannel}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="investimento" fill="#3b82f6" name="Investimento" radius={[6, 6, 0, 0]} />
            <Bar dataKey="receita" fill="#10b981" name="Receita est." radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-4 inline-flex items-center gap-1.5"><Award className="size-4 text-primary" />Top 5 campanhas</div>
        {topCampaigns.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">Sem ROAS informado.</div>
        ) : (
          <div className="space-y-3">
            {topCampaigns.map((c, i) => {
              const max = topCampaigns[0].receita;
              const pct = max > 0 ? (c.receita / max) * 100 : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{i + 1}. {c.name}</span>
                    <span className="tabular-nums text-emerald-400 font-semibold">{c.roas.toFixed(1)}x</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{brl(c.receita)} receita · {brl(c.investimento)} invest.</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedSection({ rows }: { rows: Campaign[] }) {
  const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

  const matrix = useMemo(() => rows
    .filter((c) => Number(c.investment) > 0)
    .map((c) => ({
      name: c.name,
      x: Number(c.investment),
      y: Number(c.roas),
      z: Number(c.investment) * Math.max(Number(c.roas), 0.1),
      status: c.status,
    })), [rows]);

  const medInv = useMemo(() => {
    if (matrix.length === 0) return 0;
    const s = [...matrix].sort((a, b) => a.x - b.x);
    return s[Math.floor(s.length / 2)].x;
  }, [matrix]);

  const channelEff = useMemo(() => {
    const m = new Map<string, { channel: string; investimento: number; receita: number; n: number }>();
    rows.forEach((c) => {
      const k = c.channel || "Sem canal";
      const cur = m.get(k) ?? { channel: k, investimento: 0, receita: 0, n: 0 };
      const inv = Number(c.investment);
      cur.investimento += inv;
      cur.receita += inv * Number(c.roas);
      cur.n += 1;
      m.set(k, cur);
    });
    return Array.from(m.values())
      .map((c) => ({ ...c, roas: c.investimento > 0 ? c.receita / c.investimento : 0 }))
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 6);
  }, [rows]);

  const funnel = useMemo(() => {
    const counts: Record<CStatus, number> = { programada: 0, ativa: 0, pausada: 0, concluida: 0 };
    rows.forEach((c) => { counts[c.status] += 1; });
    const order: CStatus[] = ["programada", "ativa", "pausada", "concluida"];
    return order.map((s) => ({ name: STATUS_LABEL[s], value: counts[s], fill: STATUS_COLORS[s] }));
  }, [rows]);

  if (rows.length === 0) return null;

  const maxEff = channelEff[0]?.roas ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="glass rounded-xl p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5"><Target className="size-4 text-primary" />Matriz de campanhas</div>
          <div className="text-[11px] text-muted-foreground">ROAS × Investimento · bolha = receita</div>
        </div>
        <div className="text-[11px] text-muted-foreground mb-2">Superior direito = estrelas. Inferior direito = drenando caixa.</div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="x" name="Investimento" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="number" dataKey="y" name="ROAS" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}x`} />
            <ZAxis type="number" dataKey="z" range={[60, 600]} />
            <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "ROAS 2x", fontSize: 10, fill: "#f59e0b", position: "right" }} />
            {medInv > 0 && <ReferenceLine x={medInv} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { name: string; x: number; y: number; z: number };
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
                    <div className="font-semibold mb-1">{d.name}</div>
                    <div className="text-muted-foreground">Investimento: <span className="text-foreground tabular-nums">{brl(d.x)}</span></div>
                    <div className="text-muted-foreground">ROAS: <span className="text-foreground tabular-nums">{d.y.toFixed(1)}x</span></div>
                    <div className="text-muted-foreground">Receita: <span className="text-emerald-400 tabular-nums">{brl(d.z)}</span></div>
                  </div>
                );
              }}
            />
            <Scatter data={matrix}>
              {matrix.map((d, i) => (
                <Cell key={i} fill={STATUS_COLORS[d.status as CStatus] ?? "#3b82f6"} fillOpacity={0.75} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5"><Activity className="size-4 text-primary" />Funil por status</div>
        <div className="text-[11px] text-muted-foreground mb-2">Distribuição radial das campanhas</div>
        <ResponsiveContainer width="100%" height={260}>
          <RadialBarChart innerRadius="30%" outerRadius="100%" data={funnel} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, Math.max(...funnel.map((f) => f.value), 1)]} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={6} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} layout="vertical" verticalAlign="middle" align="right" />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-5 lg:col-span-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5"><Award className="size-4 text-primary" />Eficiência por canal</div>
          <div className="text-[11px] text-muted-foreground">Receita / Investimento</div>
        </div>
        {channelEff.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Sem dados de canal.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {channelEff.map((c) => {
              const pct = maxEff > 0 ? (c.roas / maxEff) * 100 : 0;
              const tone = c.roas >= 3 ? "from-emerald-500 to-emerald-300" : c.roas >= 2 ? "from-amber-500 to-amber-300" : "from-rose-500 to-rose-300";
              const label = c.roas >= 3 ? "Excelente" : c.roas >= 2 ? "Saudável" : "Atenção";
              const labelTone = c.roas >= 3 ? "text-emerald-400" : c.roas >= 2 ? "text-amber-400" : "text-rose-400";
              return (
                <div key={c.channel} className="rounded-lg border border-border p-3 space-y-2 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{c.channel}</div>
                    <div className={`text-xs font-semibold ${labelTone}`}>{c.roas.toFixed(2)}x</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                    <span>{c.n} camp. · {brl(c.investimento)}</span>
                    <span className={labelTone}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


