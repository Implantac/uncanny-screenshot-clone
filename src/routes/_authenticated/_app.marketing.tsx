import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/use-realtime";
import { Megaphone, Calendar, Plus, Trash2, Pencil, Sparkles, Download, TrendingUp, TrendingDown, Target, DollarSign, Activity, Award, AlertTriangle, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, ScatterChart, Scatter, ZAxis, ReferenceLine, ComposedChart, Line, LabelList } from "recharts";
import { exportToCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MarketingIntelligence } from "@/components/marketing-intelligence";

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
  const [prefillName, setPrefillName] = useState<string | null>(null);
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

  const sparkData = useMemo(() => {
    const m = new Map<string, { mes: string; inv: number; rec: number }>();
    filtered.forEach((c) => {
      if (!c.start_date) return;
      const d = new Date(c.start_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = m.get(k) ?? { mes: k, inv: 0, rec: 0 };
      const inv = Number(c.investment);
      cur.inv += inv; cur.rec += inv * Number(c.roas);
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-8);
  }, [filtered]);

  const lucro = receitaEst - invTotal;
  const margemPct = invTotal > 0 ? (lucro / invTotal) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-8">
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-[image:var(--gradient-primary)] opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 size-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="size-14 shrink-0 rounded-2xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)] ring-1 ring-white/10">
              <Megaphone className="size-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-primary">
                  <span className="relative flex size-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-primary" /></span>
                  Marketing Intelligence
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight truncate">Marketing de Produto</h1>
              <p className="text-sm text-muted-foreground mt-1">Performance por produto e coleção · dados de receita lidos do ERP · {filtered.length} de {rows.length} campanhas</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">⓵ O PLM mede o impacto do produto; o ERP permanece como fonte oficial financeira.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" disabled={!filtered.length} onClick={() => exportToCsv("marketing", filtered.map((c) => ({ ...c, status: STATUS_LABEL[c.status], receita_est: Number(c.investment) * Number(c.roas) })), [
              { key: "name", label: "Campanha" }, { key: "channel", label: "Canal" },
              { key: "start_date", label: "Início" }, { key: "end_date", label: "Fim" },
              { key: "investment", label: "Investimento" }, { key: "roas", label: "ROAS" },
              { key: "receita_est", label: "Receita estimada" }, { key: "status", label: "Status" },
            ])} className="gap-2"><Download className="size-4" />Exportar</Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gap-2 shadow-[var(--shadow-glow)]">
              <Plus className="size-4" /> Nova campanha
            </Button>
          </div>
        </div>

        <div className="relative mt-6 flex items-center gap-2 flex-wrap pt-5 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mr-1 font-semibold">Período</span>
          {([
            { k: "30", label: "30D" },
            { k: "90", label: "90D" },
            { k: "365", label: "12M" },
            { k: "todos", label: "Tudo" },
          ] as const).map((p) => (
            <button key={p.k} onClick={() => setPeriodFilter(p.k)} className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${periodFilter === p.k ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-glow)]" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{p.label}</button>
          ))}
          {channels.length > 0 && <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground ml-3 mr-1 font-semibold">Canal</span>}
          {channels.length > 0 && (
            <>
              <button onClick={() => setChannelFilter("todos")} className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${channelFilter === "todos" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Todos</button>
              {channels.map((ch) => (
                <button key={ch} onClick={() => setChannelFilter(ch)} className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${channelFilter === ch ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{ch}</button>
              ))}
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Investimento" value={brl(invTotal)} icon={DollarSign} sparkData={sparkData} dataKey="inv" color="#3b82f6" />
        <StatCard label="Receita estimada" value={brl(receitaEst)} icon={TrendingUp} sparkData={sparkData} dataKey="rec" color="#10b981" />
        <StatCard label="Lucro projetado" value={brl(lucro)} icon={Award} color={lucro >= 0 ? "#10b981" : "#ef4444"} trend={{ dir: lucro >= 0 ? "up" : "down", pct: Math.abs(margemPct) }} hint={`Margem ${margemPct.toFixed(0)}%`} />
        <StatCard label="ROAS médio" value={`${roasAvg.toFixed(2)}x`} icon={Target} color={roasAvg >= 3 ? "#10b981" : roasAvg >= 2 ? "#f59e0b" : "#ef4444"} hint={roasAvg >= 3 ? "Excelente" : roasAvg >= 2 ? "Saudável" : "Atenção"} badge={`${ativas} ativas`} />
      </div>


      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="intelligence">Inteligência</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ReadyToLaunchCard campaigns={rows} onCreate={(name) => { setEditing(null); setPrefillName(name); setOpen(true); }} />
          <InsightsBar rows={filtered} invTotal={invTotal} receitaEst={receitaEst} roasAvg={roasAvg} />
          <ChartsSection rows={filtered} />
        </TabsContent>


        <TabsContent value="intelligence" className="space-y-4">
          <MarketingIntelligence />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <AdvancedSection rows={filtered} />
        </TabsContent>

        <TabsContent value="campaigns">
          {isLoading ? (
            <div className="text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <Sparkles className="size-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Sem campanhas</h3>
              <p className="text-sm text-muted-foreground mb-4">{rows.length === 0 ? "Crie a primeira campanha." : "Nenhuma campanha no filtro selecionado."}</p>
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
        </TabsContent>
      </Tabs>

      <CampaignDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPrefillName(null); }} editing={editing} userId={user?.id} prefillName={prefillName} />
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

const CHART_COLORS = ["var(--primary)", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];
const STATUS_COLORS: Record<CStatus, string> = {
  programada: "#0ea5e9", ativa: "#10b981", pausada: "#f59e0b", concluida: "#64748b",
};
const ROAS_GOAL = 3;

function StatCard({ icon: Icon, label, value, color, hint, trend, badge, sparkData, dataKey }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; color?: string; hint?: string;
  trend?: { dir: "up" | "down"; pct: number }; badge?: string;
  sparkData?: Array<Record<string, string | number>>; dataKey?: string;
}) {
  const c = color ?? "var(--primary)";
  const gid = `spark-${label.replace(/\s/g, "")}`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 group hover:border-primary/50 hover:shadow-[var(--shadow-glow)] transition-all">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute -right-8 -top-8 size-28 rounded-full opacity-[0.08] blur-2xl group-hover:opacity-20 transition-opacity" style={{ background: c }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg grid place-items-center" style={{ background: `${c}1a`, color: c }}>
            <Icon className="size-4" />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${trend.dir === "up" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
            {trend.dir === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend.pct.toFixed(0)}%
          </span>
        )}
        {badge && !trend && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">{badge}</span>
        )}
      </div>
      <div className="relative text-3xl font-bold mt-3 tabular-nums tracking-tight" style={{ color: c }}>{value}</div>
      {hint && <div className="relative text-[11px] text-muted-foreground mt-1">{hint}</div>}
      {sparkData && sparkData.length > 1 && dataKey && (
        <div className="relative -mx-5 -mb-5 mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={dataKey} stroke={c} strokeWidth={1.5} fill={`url(#${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
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
      .map((c) => ({ ...c, lucro: c.receita - c.investimento, roas: c.investimento > 0 ? c.receita / c.investimento : 0 }))
      .sort((a, b) => b.investimento - a.investimento);
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
    return Array.from(m.values())
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((d) => ({
        ...d,
        lucro: d.receita - d.investimento,
        roas: d.investimento > 0 ? d.receita / d.investimento : 0,
        mesLabel: new Date(d.mes + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      }));
  }, [rows]);

  const topCampaigns = useMemo(() =>
    [...rows]
      .filter((c) => Number(c.roas) > 0)
      .map((c) => ({
        name: c.name.length > 24 ? c.name.slice(0, 24) + "…" : c.name,
        roas: Number(c.roas),
        receita: Number(c.investment) * Number(c.roas),
        investimento: Number(c.investment),
        lucro: Number(c.investment) * Number(c.roas) - Number(c.investment),
      }))
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5),
  [rows]);

  if (rows.length === 0) return null;

  const totalAtivas = byStatus.find((s) => s.status === "ativa")?.value ?? 0;
  const totalCamp = byStatus.reduce((a, b) => a + b.value, 0);

  const tooltipStyle = { backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--card-foreground)" };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="glass rounded-xl p-5 lg:col-span-2">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Evolução mensal · ROAS vs. Investimento</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Barras: investimento e receita · Linha: ROAS · Meta: {ROAS_GOAL}x</div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#3b82f6]" />Invest.</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#10b981]" />Receita</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[var(--primary)]" />ROAS</span>
          </div>
        </div>
        {byMonth.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-16">Sem datas de início informadas.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={byMonth} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mesLabel" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="money" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="roas" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                formatter={(v: number, name: string) => name === "ROAS" ? [`${v.toFixed(2)}x`, name] : [brl(v), name]}
              />
              <ReferenceLine yAxisId="roas" y={ROAS_GOAL} stroke="var(--primary)" strokeDasharray="4 4" label={{ value: `Meta ${ROAS_GOAL}x`, fontSize: 10, fill: "var(--primary)", position: "insideTopRight" }} />
              <Bar yAxisId="money" dataKey="investimento" fill="url(#gInv)" name="Investimento" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar yAxisId="money" dataKey="receita" fill="url(#gRec)" name="Receita" radius={[4, 4, 0, 0]} barSize={18} />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 5 }} name="ROAS" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="glass rounded-xl p-5 flex flex-col">
        <div className="text-sm font-semibold mb-1">Mix de status</div>
        <div className="text-[11px] text-muted-foreground mb-3">Distribuição das campanhas</div>
        <div className="relative flex-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={92} paddingAngle={3} stroke="none">
                {byStatus.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} campanha${v === 1 ? "" : "s"}`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{totalAtivas}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">de {totalCamp} ativas</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {byStatus.map((s) => (
            <div key={s.status} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/40">
              <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />{s.name}</span>
              <span className="tabular-nums font-semibold">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Performance por canal</div>
          <div className="text-[11px] text-muted-foreground">Investimento, receita e ROAS</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={byChannel} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="channel" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="money" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="roas" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              formatter={(v: number, name: string) => name === "ROAS" ? [`${v.toFixed(2)}x`, name] : [brl(v), name]}
            />
            <Bar yAxisId="money" dataKey="investimento" fill="#3b82f6" name="Investimento" radius={[4, 4, 0, 0]} barSize={22} />
            <Bar yAxisId="money" dataKey="receita" fill="#10b981" name="Receita" radius={[4, 4, 0, 0]} barSize={22} />
            <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--primary)" }} name="ROAS">
              <LabelList dataKey="roas" position="top" fontSize={10} fill="var(--primary)" formatter={(v: number) => `${v.toFixed(1)}x`} />
            </Line>
            <ReferenceLine yAxisId="roas" y={ROAS_GOAL} stroke="var(--primary)" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5"><Award className="size-4 text-primary" />Top 5 por lucro</div>
        <div className="text-[11px] text-muted-foreground mb-4">Receita − investimento</div>
        {topCampaigns.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">Sem ROAS informado.</div>
        ) : (
          <div className="space-y-3">
            {topCampaigns.map((c, i) => {
              const max = Math.max(...topCampaigns.map((t) => Math.abs(t.lucro)), 1);
              const pct = Math.min(100, (Math.abs(c.lucro) / max) * 100);
              const positive = c.lucro >= 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
                      {c.name}
                    </span>
                    <span className={`tabular-nums font-semibold ${positive ? "text-emerald-400" : "text-rose-400"}`}>{positive ? "+" : ""}{brl(c.lucro)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${positive ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-gradient-to-r from-rose-500 to-rose-300"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                    <span>{brl(c.investimento)} → {brl(c.receita)}</span>
                    <span className="font-semibold text-foreground/80">{c.roas.toFixed(2)}x</span>
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

function AdvancedSection({ rows }: { rows: Campaign[] }) {
  const tooltipStyle = { backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--card-foreground)" };

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
      .map((c) => ({ ...c, roas: c.investimento > 0 ? c.receita / c.investimento : 0, lucro: c.receita - c.investimento }))
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 6);
  }, [rows]);

  const pipeline = useMemo(() => {
    const counts: Record<CStatus, { count: number; invest: number }> = {
      programada: { count: 0, invest: 0 }, ativa: { count: 0, invest: 0 },
      pausada: { count: 0, invest: 0 }, concluida: { count: 0, invest: 0 },
    };
    rows.forEach((c) => { counts[c.status].count += 1; counts[c.status].invest += Number(c.investment); });
    const order: CStatus[] = ["programada", "ativa", "pausada", "concluida"];
    const total = rows.length || 1;
    return order.map((s) => ({
      key: s,
      name: STATUS_LABEL[s],
      count: counts[s].count,
      invest: counts[s].invest,
      pct: (counts[s].count / total) * 100,
      fill: STATUS_COLORS[s],
    }));
  }, [rows]);

  if (rows.length === 0) return null;

  const maxEff = channelEff[0]?.roas ?? 0;
  const maxPipeline = Math.max(...pipeline.map((p) => p.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="glass rounded-xl p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5"><Target className="size-4 text-primary" />Matriz BCG · ROAS × Investimento</div>
          <div className="text-[11px] text-muted-foreground">Bolha = receita estimada</div>
        </div>
        <div className="text-[11px] text-muted-foreground mb-2">Superior direito: <span className="text-emerald-400">estrelas</span> · Inferior direito: <span className="text-rose-400">drenando caixa</span></div>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" dataKey="x" name="Investimento" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="number" dataKey="y" name="ROAS" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}x`} />
            <ZAxis type="number" dataKey="z" range={[80, 700]} />
            <ReferenceLine y={ROAS_GOAL} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Meta ${ROAS_GOAL}x`, fontSize: 10, fill: "#10b981", position: "right" }} />
            <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Breakeven", fontSize: 10, fill: "#ef4444", position: "right" }} />
            {medInv > 0 && <ReferenceLine x={medInv} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { name: string; x: number; y: number; z: number };
                const lucro = d.z - d.x;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
                    <div className="font-semibold mb-1">{d.name}</div>
                    <div className="text-muted-foreground">Investimento: <span className="text-foreground tabular-nums">{brl(d.x)}</span></div>
                    <div className="text-muted-foreground">ROAS: <span className="text-foreground tabular-nums">{d.y.toFixed(2)}x</span></div>
                    <div className="text-muted-foreground">Receita: <span className="text-emerald-400 tabular-nums">{brl(d.z)}</span></div>
                    <div className="text-muted-foreground">Lucro: <span className={`tabular-nums ${lucro >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{brl(lucro)}</span></div>
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
        <div className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5"><Activity className="size-4 text-primary" />Pipeline por status</div>
        <div className="text-[11px] text-muted-foreground mb-4">Volume e investimento alocado</div>
        <div className="space-y-3">
          {pipeline.map((p) => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-2 rounded-full" style={{ background: p.fill }} />
                  {p.name}
                </span>
                <span className="tabular-nums text-muted-foreground">{p.count} · {p.pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(p.count / maxPipeline) * 100}%`, background: p.fill }} />
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{brl(p.invest)} alocado</div>
            </div>
          ))}
        </div>
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
                    <div className={`text-xs font-semibold tabular-nums ${labelTone}`}>{c.roas.toFixed(2)}x</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                    <span>{c.n} camp. · {brl(c.investimento)}</span>
                    <span className={labelTone}>{label}</span>
                  </div>
                  <div className="text-[10px] tabular-nums pt-1 border-t border-border/50 flex justify-between">
                    <span className="text-muted-foreground">Lucro projetado</span>
                    <span className={c.lucro >= 0 ? "text-emerald-400" : "text-rose-400"}>{c.lucro >= 0 ? "+" : ""}{brl(c.lucro)}</span>
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


