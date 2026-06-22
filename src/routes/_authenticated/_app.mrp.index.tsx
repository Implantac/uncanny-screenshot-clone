import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Download,
  Settings2,
  Search,
  TrendingDown,
  TrendingUp,
  PackageX,
  ShoppingCart,
  ArrowLeft,
  Loader2,
  Bell,
  FileText,
  Sparkles,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeMrpPlanning,
  getMrpConfig,
  saveMrpConfig,
  type MrpRow,
  type MrpStatus,
} from "@/lib/mrp-planning.functions";
import { syncMrpAlerts } from "@/lib/mrp-material.functions";
import { MrpMaterialDrawer } from "@/components/mrp-material-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportToCsv } from "@/lib/csv";

type MrpSearch = { status?: MrpStatus | "all"; q?: string; category?: string };

export const Route = createFileRoute("/_authenticated/_app/mrp")({
  validateSearch: (s: Record<string, unknown>): MrpSearch => {
    const allowed: Array<MrpStatus | "all"> = ["all", "critico", "atencao", "normal", "excesso"];
    const status = allowed.includes(s.status as MrpStatus | "all")
      ? (s.status as MrpStatus | "all")
      : undefined;
    const q = typeof s.q === "string" && s.q ? s.q : undefined;
    const category = typeof s.category === "string" && s.category ? s.category : undefined;
    return { status, q, category };
  },
  head: () => ({
    meta: [
      { title: "MRP Inteligente · USE MODA PLM" },
      {
        name: "description",
        content:
          "Planejamento de materiais com estoque mínimo/máximo, ponto de pedido, LEC e sugestão de compra.",
      },
    ],
  }),
  component: MrpPage,
});

const STATUS_LABEL: Record<MrpStatus, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  normal: "Normal",
  excesso: "Excesso",
};
const STATUS_CLASS: Record<MrpStatus, string> = {
  critico: "bg-destructive/10 text-destructive border-destructive/30",
  atencao: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  normal: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  excesso: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

function MrpPage() {
  const qc = useQueryClient();
  const computeFn = useServerFn(computeMrpPlanning);
  const getCfgFn = useServerFn(getMrpConfig);
  const saveCfgFn = useServerFn(saveMrpConfig);

  const sp = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = sp.q ?? "";
  const category = sp.category ?? "all";
  const status = sp.status ?? "all";

  const updateSearch = useCallback(
    (patch: Partial<MrpSearch>) => {
      navigate({
        search: (prev: MrpSearch) => {
          const next: MrpSearch = { ...prev, ...patch };
          if (!next.q) delete next.q;
          if (!next.status || next.status === "all") delete next.status;
          if (!next.category || next.category === "all") delete next.category;
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );
  const setSearch = (v: string) => updateSearch({ q: v });
  const setCategory = (v: string) => updateSearch({ category: v });
  const setStatus = (v: string) => updateSearch({ status: v as MrpStatus | "all" });

  const [cfgOpen, setCfgOpen] = useState(false);
  const [openRow, setOpenRow] = useState<MrpRow | null>(null);
  const alertsFn = useServerFn(syncMrpAlerts);
  const runAlerts = useMutation({
    mutationFn: () => alertsFn({}),
    onSuccess: (r) => toast.success(`${r.created} alerta(s) MRP gerado(s)`),
    onError: (e) => toast.error((e as Error).message),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["mrp", "planning"],
    queryFn: () => computeFn({ data: {} }),
  });
  const { data: cfg } = useQuery({
    queryKey: ["mrp", "config"],
    queryFn: () => getCfgFn({}),
  });

  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const holdingPct = (cfg?.holding_cost_pct ?? 3.9) / 100;
  const annualHoldingCost = useMemo(
    () => rows.reduce((acc, r) => acc + r.capitalEmpatado * holdingPct, 0),
    [rows, holdingPct],
  );
  const annualDemandTotal = useMemo(
    () => rows.reduce((acc, r) => acc + r.annualDemand, 0),
    [rows],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (status !== "all" && r.status !== status) return false;
      if (
        s &&
        !r.sku.toLowerCase().includes(s) &&
        !r.name.toLowerCase().includes(s) &&
        !(r.supplierName ?? "").toLowerCase().includes(s)
      )
        return false;
      return true;
    });
  }, [rows, search, category, status]);

  const saveCfg = useMutation({
    mutationFn: (vars: {
      service_level: number;
      order_cost: number;
      holding_cost_pct: number;
      working_days_per_month: number;
      history_days: number;
    }) => saveCfgFn({ data: vars }),
    onSuccess: () => {
      toast.success("Parâmetros MRP atualizados");
      setCfgOpen(false);
      qc.invalidateQueries({ queryKey: ["mrp"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Activity className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">MRP Inteligente</h1>
            <p className="text-sm text-muted-foreground">
              {summary?.totalSkus ?? 0} SKUs · {summary?.itemsCritical ?? 0} críticos ·{" "}
              {summary?.suggestedItems ?? 0} sugestões de compra
              {isFetching && " · atualizando…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/almoxarifado">
              <ArrowLeft className="size-4" /> Almoxarifado
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/mrp/bi">
              <Activity className="size-4" /> BI MRP
            </Link>
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link to="/mrp/executivo">
              <Sparkles className="size-4" /> Executivo IA
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAlerts.mutate()}
            disabled={runAlerts.isPending}
          >
            {runAlerts.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}{" "}
            Gerar alertas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copiado", {
                  description: "URL com filtros atuais na área de transferência.",
                });
              } catch {
                toast.error("Não foi possível copiar o link");
              }
            }}
          >
            <Link2 className="size-4" /> Copiar link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCsv(
                "mrp-planejamento",
                filtered,
                [
                  { key: "sku", label: "Código" },
                  { key: "name", label: "Descrição" },
                  { key: "supplierName", label: "Fornecedor" },
                  { key: "balance", label: "Estoque atual" },
                  { key: "dailyConsumption", label: "Consumo diário" },
                  { key: "leadTimeDays", label: "Lead time" },
                  { key: "stdDev", label: "Desvio padrão" },
                  { key: "safetyStock", label: "Estoque segurança" },
                  { key: "reorderPoint", label: "Ponto de pedido" },
                  { key: "minimum", label: "Mínimo" },
                  { key: "eoq", label: "LEC" },
                  { key: "maximum", label: "Máximo" },
                  { key: "coverageDays", label: "Cobertura (dias)" },
                  { key: "capitalEmpatado", label: "Capital empatado" },
                  { key: "turnover", label: "Giro" },
                  { key: "suggestedPurchase", label: "Sugestão compra" },
                  { key: "status", label: "Status" },
                ],
              )
            }
            disabled={!filtered.length}
          >
            <Download className="size-4" /> Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={async () => {
              const { default: jsPDF } = await import("jspdf");
              const { default: autoTable } = await import("jspdf-autotable");
              const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
              doc.setFontSize(14);
              doc.text("MRP — Planejamento de Materiais", 40, 40);
              doc.setFontSize(9);
              doc.text(
                `Gerado em ${new Date().toLocaleString("pt-BR")} · ${filtered.length} itens · Valor: ${brl(summary?.totalStockValue ?? 0)} · Sugerido: ${brl(summary?.suggestedValue ?? 0)}`,
                40,
                58,
              );
              autoTable(doc, {
                startY: 72,
                head: [["Código", "Descrição", "Fornec.", "Saldo", "PP", "Mín", "LEC", "Máx", "Cob (d)", "Sug.", "Status"]],
                body: filtered.map((r) => [
                  r.sku,
                  r.name.slice(0, 38),
                  (r.supplierName ?? "").slice(0, 18),
                  num(r.balance),
                  num(r.reorderPoint),
                  num(r.minimum),
                  num(r.eoq),
                  num(r.maximum),
                  r.coverageDays ?? "—",
                  num(r.suggestedPurchase),
                  STATUS_LABEL[r.status],
                ]),
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [30, 30, 30] },
                columnStyles: { 1: { cellWidth: 150 } },
              });
              doc.save(`mrp-planejamento-${new Date().toISOString().slice(0, 10)}.pdf`);
            }}
          >
            <FileText className="size-4" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCfgOpen(true)}>
            <Settings2 className="size-4" /> Parâmetros
          </Button>
        </div>
      </header>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Card
          label="Valor em estoque"
          value={brl(summary?.totalStockValue ?? 0)}
          tone="default"
        />
        <Card
          label="Capital parado"
          value={brl(summary?.capitalParado ?? 0)}
          icon={<TrendingDown className="size-4 text-amber-500" />}
          tone="warning"
        />
        <Card
          label="Custo armazenagem/ano"
          value={brl(annualHoldingCost)}
          tone="warning"
        />
        <Card
          label="Demanda anual (un)"
          value={num(annualDemandTotal)}
          tone="default"
        />
        <Card
          label="Críticos"
          value={String(summary?.itemsCritical ?? 0)}
          icon={<AlertTriangle className="size-4 text-destructive" />}
          tone="danger"
        />
        <Card
          label="Em excesso"
          value={String(summary?.itemsExcess ?? 0)}
          icon={<TrendingUp className="size-4 text-blue-500" />}
          tone="info"
        />
        <Card
          label="Cobertura média"
          value={summary?.avgCoverage !== null && summary?.avgCoverage !== undefined ? `${summary.avgCoverage}d` : "—"}
          tone="default"
        />
        <Card
          label="Compras sugeridas"
          value={`${summary?.suggestedItems ?? 0} · ${brl(summary?.suggestedValue ?? 0)}`}
          icon={<ShoppingCart className="size-4 text-primary" />}
          tone="default"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descrição ou fornecedor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="tecido">Tecido</SelectItem>
            <SelectItem value="aviamento">Aviamento</SelectItem>
            <SelectItem value="acabado">Acabado</SelectItem>
            <SelectItem value="outros">Outros</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="excesso">Excesso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th colSpan={3} className="px-3 py-1.5 text-left font-semibold border-b border-border/60 bg-muted/70">Identificação</th>
                <th colSpan={3} className="px-3 py-1.5 text-left font-semibold border-b border-l border-border/60 bg-muted/40">Demanda</th>
                <th colSpan={5} className="px-3 py-1.5 text-left font-semibold border-b border-l border-border/60 bg-muted/40">Política de estoque</th>
                <th colSpan={3} className="px-3 py-1.5 text-left font-semibold border-b border-l border-border/60 bg-muted/40">Saldo & cobertura</th>
                <th colSpan={3} className="px-3 py-1.5 text-left font-semibold border-b border-l border-border/60 bg-muted/40">Ação</th>
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-muted/70 px-3 py-2 text-left">Código</th>
                <th className="sticky left-[96px] z-10 bg-muted/70 px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Fornecedor</th>
                <th className="px-3 py-2 text-right border-l border-border/60">Cons/d</th>
                <th className="px-3 py-2 text-right">Dem/mês</th>
                <th className="px-3 py-2 text-right">Dem/ano</th>
                <th className="px-3 py-2 text-right border-l border-border/60">LT</th>
                <th className="px-3 py-2 text-right">ES</th>
                <th className="px-3 py-2 text-right">PP</th>
                <th className="px-3 py-2 text-right">LEC</th>
                <th className="px-3 py-2 text-right">Máx</th>
                <th className="px-3 py-2 text-right border-l border-border/60">Estoque</th>
                <th className="px-3 py-2 text-left">Saldo × política</th>
                <th className="px-3 py-2 text-right">Cob</th>
                <th className="px-3 py-2 text-right border-l border-border/60">Capital</th>
                <th className="px-3 py-2 text-right">Sugestão</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin inline-block mr-2" /> Calculando MRP…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-muted-foreground">
                    Nenhum item encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <Row key={r.id} r={r} onOpen={() => setOpenRow(r)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Fórmulas: ES = Z·σ·√LT · PP = consumo×LT + ES · LEC = √(2·D·S/H) · Máx = Mín + LEC ·
        Cobertura = saldo ÷ consumo diário. Histórico: {cfg?.history_days ?? 90} dias. Nível de
        serviço: {cfg?.service_level ?? 95}%.
      </p>

      <CfgDialog
        open={cfgOpen}
        onOpenChange={setCfgOpen}
        cfg={cfg}
        onSave={(v) => saveCfg.mutate(v)}
        saving={saveCfg.isPending}
      />
      <MrpMaterialDrawer row={openRow} onClose={() => setOpenRow(null)} />
    </div>
  );
}

function Card({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone: "default" | "danger" | "warning" | "info";
}) {
  const toneCls =
    tone === "danger"
      ? "border-destructive/30"
      : tone === "warning"
        ? "border-amber-500/30"
        : tone === "info"
          ? "border-blue-500/30"
          : "border-border";
  return (
    <div className={`rounded-xl border ${toneCls} bg-card/50 p-4`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground mb-1">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Row({ r, onOpen }: { r: MrpRow; onOpen: () => void }) {
  // Barra: escala = max(maximum, balance, reorderPoint) * 1.1
  const scale = Math.max(r.maximum, r.balance, r.reorderPoint, 1) * 1.1;
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  const barTone =
    r.status === "critico"
      ? "bg-destructive"
      : r.status === "atencao"
        ? "bg-amber-500"
        : r.status === "excesso"
          ? "bg-blue-500"
          : "bg-emerald-500";
  const accent =
    r.status === "critico"
      ? "border-l-destructive"
      : r.status === "atencao"
        ? "border-l-amber-500"
        : r.status === "excesso"
          ? "border-l-blue-500"
          : "border-l-emerald-500";
  return (
    <tr
      className={`border-t border-border hover:bg-muted/30 cursor-pointer border-l-2 ${accent}`}
      onClick={onOpen}
    >
      <td className="sticky left-0 z-10 bg-background hover:bg-muted/30 px-3 py-2 font-mono text-xs">{r.sku}</td>
      <td className="sticky left-[96px] z-10 bg-background hover:bg-muted/30 px-3 py-2">
        <div className="font-medium truncate max-w-[200px]">{r.name}</div>
        {!r.hasHistory && (
          <div className="text-[10px] text-muted-foreground">sem histórico de saída</div>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground text-xs">{r.supplierName ?? "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums border-l border-border/40">{num(r.dailyConsumption, 1)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{num(r.monthlyDemand)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{num(r.annualDemand)}</td>
      <td className="px-3 py-2 text-right tabular-nums border-l border-border/40">{r.leadTimeDays}d</td>
      <td className="px-3 py-2 text-right tabular-nums">{num(r.safetyStock)}</td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{num(r.reorderPoint)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{num(r.eoq)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{num(r.maximum)}</td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold border-l border-border/40">{num(r.balance)}</td>
      <td className="px-3 py-2 w-[160px]">
        <div className="relative h-2 rounded-full bg-muted overflow-visible">
          {/* zona até PP = vermelho claro, PP→Máx = verde claro, >Máx = azul claro */}
          <div
            className="absolute inset-y-0 left-0 bg-destructive/15 rounded-l-full"
            style={{ width: pct(r.reorderPoint) }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-500/15"
            style={{ left: pct(r.reorderPoint), width: `calc(${pct(r.maximum)} - ${pct(r.reorderPoint)})` }}
          />
          {/* marcador Saldo */}
          <div
            className={`absolute -top-0.5 h-3 w-1 rounded-sm ${barTone}`}
            style={{ left: `calc(${pct(r.balance)} - 2px)` }}
            title={`Saldo ${num(r.balance)}`}
          />
          {/* marcador PP (linha) */}
          <div
            className="absolute -top-1 h-4 w-px bg-foreground/60"
            style={{ left: pct(r.reorderPoint) }}
            title={`PP ${num(r.reorderPoint)}`}
          />
          {/* marcador Máx */}
          <div
            className="absolute -top-1 h-4 w-px bg-foreground/40"
            style={{ left: pct(r.maximum) }}
            title={`Máx ${num(r.maximum)}`}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1 tabular-nums">
          <span>0</span>
          <span>PP {num(r.reorderPoint)}</span>
          <span>Máx {num(r.maximum)}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {r.coverageDays !== null ? `${r.coverageDays}d` : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground border-l border-border/40">
        {brl(r.capitalEmpatado)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {r.suggestedPurchase > 0 ? (
          <div>
            <div className="font-medium text-primary">{num(r.suggestedPurchase)}</div>
            <div className="text-[10px] text-muted-foreground">{brl(r.suggestedValue)}</div>
          </div>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_CLASS[r.status]} uppercase tracking-wide font-medium whitespace-nowrap`}
        >
          {STATUS_LABEL[r.status]}
        </span>
      </td>
    </tr>
  );
}

function CfgDialog({
  open,
  onOpenChange,
  cfg,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  cfg:
    | {
        service_level: number;
        order_cost: number;
        holding_cost_pct: number;
        working_days_per_month: number;
        history_days: number;
      }
    | undefined;
  onSave: (v: {
    service_level: number;
    order_cost: number;
    holding_cost_pct: number;
    working_days_per_month: number;
    history_days: number;
  }) => void;
  saving: boolean;
}) {
  const [sl, setSl] = useState(cfg?.service_level ?? 95);
  const [oc, setOc] = useState(cfg?.order_cost ?? 10);
  const [hc, setHc] = useState(cfg?.holding_cost_pct ?? 3.9);
  const [wd, setWd] = useState(cfg?.working_days_per_month ?? 22);
  const [hd, setHd] = useState(cfg?.history_days ?? 90);

  // sincroniza quando cfg chega
  useMemo(() => {
    if (cfg) {
      setSl(cfg.service_level);
      setOc(cfg.order_cost);
      setHc(cfg.holding_cost_pct);
      setWd(cfg.working_days_per_month);
      setHd(cfg.history_days);
    }
  }, [cfg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parâmetros do MRP</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nível de serviço (%)</Label>
            <Select value={String(sl)} onValueChange={(v) => setSl(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90% (Z=1,28)</SelectItem>
                <SelectItem value="95">95% (Z=1,65)</SelectItem>
                <SelectItem value="97">97% (Z=1,88)</SelectItem>
                <SelectItem value="99">99% (Z=2,33)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Custo do pedido S (R$)</Label>
            <Input type="number" step="0.01" value={oc} onChange={(e) => setOc(Number(e.target.value))} />
          </div>
          <div>
            <Label>Custo armazenagem H (% a.a.)</Label>
            <Input type="number" step="0.1" value={hc} onChange={(e) => setHc(Number(e.target.value))} />
          </div>
          <div>
            <Label>Dias úteis/mês</Label>
            <Input type="number" value={wd} onChange={(e) => setWd(Number(e.target.value))} />
          </div>
          <div>
            <Label>Janela histórica (dias)</Label>
            <Input type="number" value={hd} onChange={(e) => setHd(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                service_level: sl,
                order_cost: oc,
                holding_cost_pct: hc,
                working_days_per_month: wd,
                history_days: hd,
              })
            }
            disabled={saving}
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
