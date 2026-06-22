import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Award,
  Box,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Factory,
  Gauge,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Star,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupplier360, type Supplier360 } from "@/lib/supplier-360.functions";

interface Props {
  supplierId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HEALTH_TINT = {
  saudavel: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  atencao: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  critico: "bg-destructive/15 text-destructive border-destructive/40",
};

const HEALTH_LABEL = {
  saudavel: "Saudável",
  atencao: "Atenção",
  critico: "Crítico",
};

export function Supplier360Drawer({ supplierId, open, onOpenChange }: Props) {
  const fn = useServerFn(getSupplier360);
  const q = useQuery({
    queryKey: ["supplier-360", supplierId],
    queryFn: () => fn({ data: { supplier_id: supplierId! } }) as Promise<Supplier360>,
    enabled: !!supplierId && open,
    refetchInterval: open ? 60_000 : false,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {q.isLoading || !q.data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
            <Loader2 className="size-4 animate-spin" /> Carregando 360°…
          </div>
        ) : (
          <DrawerBody data={q.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ data }: { data: Supplier360 }) {
  const { supplier, kpis, reason, top_defects, top_products, capabilities, compliance, orders_active, orders_recent, occurrences_recent } = data;
  const tint = HEALTH_TINT[kpis.health];

  return (
    <>
      <SheetHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Factory className="size-5 text-primary" />
            {supplier.name}
          </SheetTitle>
          <Badge variant="outline" className={tint}>
            {HEALTH_LABEL[kpis.health]} · {kpis.score}/100
          </Badge>
        </div>
        <SheetDescription className="flex flex-wrap gap-3 text-xs">
          {supplier.category && <span>{supplier.category}</span>}
          {(supplier.city || supplier.state) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {[supplier.city, supplier.state].filter(Boolean).join(" / ")}
            </span>
          )}
          {supplier.email && (
            <span className="flex items-center gap-1">
              <Mail className="size-3" />
              {supplier.email}
            </span>
          )}
          {supplier.phone && (
            <span className="flex items-center gap-1">
              <Phone className="size-3" />
              {supplier.phone}
            </span>
          )}
          {supplier.rating ? (
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-3 ${i < (supplier.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                />
              ))}
            </span>
          ) : null}
        </SheetDescription>
      </SheetHeader>

      {/* Reason / leitura IA */}
      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
        <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">{reason}</div>
      </div>

      {/* KPI grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi
          icon={ClipboardCheck}
          label="FPY"
          value={kpis.fpy !== null ? `${kpis.fpy}%` : "—"}
          sub={`${kpis.inspections_count} inspeções`}
          tone={kpis.fpy === null ? "" : kpis.fpy >= 90 ? "good" : kpis.fpy >= 75 ? "warn" : "bad"}
        />
        <Kpi
          icon={Clock}
          label="Pontualidade"
          value={kpis.on_time_pct !== null ? `${kpis.on_time_pct}%` : "—"}
          sub={`${kpis.orders_done_count} entregues`}
          tone={kpis.on_time_pct === null ? "" : kpis.on_time_pct >= 90 ? "good" : kpis.on_time_pct >= 75 ? "warn" : "bad"}
        />
        <Kpi
          icon={TrendingUp}
          label="Lead time"
          value={kpis.lead_time_avg_days !== null ? `${kpis.lead_time_avg_days}d` : "—"}
          sub={kpis.lead_time_p90_days !== null ? `p90 ${kpis.lead_time_p90_days}d` : `contratado ${kpis.contracted_lead_time_days ?? "—"}d`}
        />
        <Kpi
          icon={Gauge}
          label="Utilização"
          value={kpis.utilization_pct !== null ? `${kpis.utilization_pct}%` : "—"}
          sub={kpis.monthly_capacity ? `cap. ${kpis.monthly_capacity}/mês` : "sem capacidade"}
          tone={kpis.utilization_pct === null ? "" : kpis.utilization_pct > 95 ? "warn" : kpis.utilization_pct > 110 ? "bad" : "good"}
        />
        <Kpi
          icon={Box}
          label="OPs ativas"
          value={String(kpis.orders_active_count)}
          sub={`${kpis.in_progress_qty} pç em curso`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Ocorrências"
          value={String(kpis.occurrences_open)}
          sub={`${kpis.occurrences_total} no período`}
          tone={kpis.occurrences_open > 0 ? "warn" : ""}
        />
        <Kpi
          icon={XCircle}
          label="Defeitos críticos"
          value={String(kpis.critical_defects)}
          sub={`${kpis.major_defects} maiores`}
          tone={kpis.critical_defects > 0 ? "bad" : ""}
        />
        <Kpi
          icon={Award}
          label="Compliance"
          value={String(compliance.length)}
          sub={kpis.certifications_expired > 0 ? `${kpis.certifications_expired} vencidas` : "em dia"}
          tone={kpis.certifications_expired > 0 ? "bad" : ""}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ops" className="mt-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ops" className="gap-1 text-xs">
            <Factory className="size-3.5" /> OPs ({orders_active.length})
          </TabsTrigger>
          <TabsTrigger value="quality" className="gap-1 text-xs">
            <ClipboardCheck className="size-3.5" /> Qualidade
          </TabsTrigger>
          <TabsTrigger value="capability" className="gap-1 text-xs">
            <Gauge className="size-3.5" /> Capac.
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs">
            <Activity className="size-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ops" className="mt-3 space-y-1.5">
          {!orders_active.length ? (
            <Empty text="Sem OPs ativas neste fornecedor." />
          ) : (
            orders_active.map((o) => (
              <Link
                key={o.id}
                to="/lote/$id"
                params={{ id: o.id }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-xs hover:bg-accent/30 transition group"
              >
                <div className="font-mono shrink-0">{o.code}</div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {o.stage ?? "—"}
                </Badge>
                <span className="text-muted-foreground">{o.quantity ?? 0} pç</span>
                <span className="flex-1" />
                {o.days_to_due !== null && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      o.days_to_due < 0
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : o.days_to_due <= 3
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                          : ""
                    }`}
                  >
                    {o.days_to_due < 0 ? `vencida ${Math.abs(o.days_to_due)}d` : `${o.days_to_due}d`}
                  </Badge>
                )}
                <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="quality" className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold mb-1.5">Top defeitos no período</h4>
            {!top_defects.length ? (
              <Empty text="Sem defeitos categorizados." />
            ) : (
              <ul className="space-y-1">
                {top_defects.map((d) => (
                  <li key={d.category} className="flex items-center justify-between text-xs rounded border border-border bg-card p-2">
                    <span className="capitalize">{d.category}</span>
                    <Badge variant="outline">{d.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-1.5">Produtos mais produzidos</h4>
            {!top_products.length ? (
              <Empty text="Sem produtos no período." />
            ) : (
              <ul className="space-y-1">
                {top_products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs rounded border border-border bg-card p-2">
                    <span className="truncate">{p.name ?? p.sku ?? p.id.slice(0, 8)}</span>
                    <Badge variant="outline">{p.quantity} pç</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="capability" className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold mb-1.5">Especialidades</h4>
            {!capabilities.length ? (
              <Empty text="Sem capabilities cadastradas." />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {capabilities.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {c.capability}
                    {c.monthly_capacity ? ` · ${c.monthly_capacity}/mês` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-1.5">Certificações</h4>
            {!compliance.length ? (
              <Empty text="Nenhuma certificação registrada." />
            ) : (
              <ul className="space-y-1">
                {compliance.map((c, i) => (
                  <li
                    key={i}
                    className={`flex items-center justify-between text-xs rounded border p-2 ${
                      c.expired
                        ? "border-destructive/40 bg-destructive/5"
                        : c.expiring_soon
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border bg-card"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{c.cert_type}</div>
                      <div className="text-muted-foreground">
                        {c.issuer ?? "—"} {c.cert_number ? `· ${c.cert_number}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {c.expires_at && (
                        <div className={c.expired ? "text-destructive" : c.expiring_soon ? "text-amber-700" : ""}>
                          {c.expired ? "vencida" : "vence"} {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold mb-1.5">Entregas recentes</h4>
            {!orders_recent.length ? (
              <Empty text="Sem entregas no período." />
            ) : (
              <ul className="space-y-1">
                {orders_recent.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-xs rounded border border-border bg-card p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {o.on_time === true ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      ) : o.on_time === false ? (
                        <XCircle className="size-3.5 text-destructive shrink-0" />
                      ) : null}
                      <span className="font-mono">{o.code}</span>
                      <span className="text-muted-foreground">{o.quantity} pç</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(o.delivered_at).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-1.5">Ocorrências recentes</h4>
            {!occurrences_recent.length ? (
              <Empty text="Sem ocorrências no período." />
            ) : (
              <ul className="space-y-1">
                {occurrences_recent.map((o) => (
                  <li key={o.id} className="text-xs rounded border border-border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`size-3.5 shrink-0 ${o.status === "aberta" ? "text-amber-600" : "text-muted-foreground"}`}
                      />
                      <span className="capitalize font-medium">{o.kind}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{o.status}</Badge>
                      <span className="flex-1" />
                      <span className="text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {o.description && (
                      <div className="text-muted-foreground mt-1 line-clamp-2">{o.description}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = "",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad" | "";
}) {
  const valueColor =
    tone === "good" ? "text-emerald-700" :
    tone === "warn" ? "text-amber-700" :
    tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Icon className="size-3" />
        {label}
      </div>
      <div className={`text-lg font-semibold mt-0.5 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground italic py-2">{text}</div>;
}
