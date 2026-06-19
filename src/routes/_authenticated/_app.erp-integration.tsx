import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  RefreshCw,
  Save,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  getErpConfig,
  saveErpConfig,
  regenerateWebhookId,
  getRecentErpSyncs,
} from "@/lib/erp-sync.functions";

export const Route = createFileRoute("/_authenticated/_app/erp-integration")({
  head: () => ({
    meta: [
      { title: "Integração ERP · USE MODA PLM" },
      { name: "description", content: "Webhook HMAC, último sync e fila de erros." },
    ],
  }),
  component: ErpIntegrationPage,
});

function ErpIntegrationPage() {
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getErpConfig);
  const saveCfg = useServerFn(saveErpConfig);
  const regen = useServerFn(regenerateWebhookId);
  const fetchLogs = useServerFn(getRecentErpSyncs);

  const cfgQ = useQuery({ queryKey: ["erp-config"], queryFn: () => fetchCfg() });
  const logsQ = useQuery({
    queryKey: ["erp-logs"],
    queryFn: () => fetchLogs(),
    refetchInterval: 10_000,
  });

  const [erpName, setErpName] = useState("");
  const [erpEndpoint, setErpEndpoint] = useState("");
  const [active, setActive] = useState(true);

  // Hydrate form once
  if (cfgQ.data && erpName === "" && cfgQ.data.erp_name && erpName !== cfgQ.data.erp_name) {
    setErpName(cfgQ.data.erp_name ?? "");
    setErpEndpoint(cfgQ.data.erp_endpoint ?? "");
    setActive(cfgQ.data.active ?? true);
  }

  const saveMut = useMutation({
    mutationFn: () => saveCfg({ data: { erp_name: erpName, erp_endpoint: erpEndpoint, active } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["erp-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenMut = useMutation({
    mutationFn: () => regen(),
    onSuccess: () => {
      toast.success("Webhook regenerado");
      qc.invalidateQueries({ queryKey: ["erp-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const webhookUrl =
    typeof window !== "undefined" && cfgQ.data
      ? `${window.location.origin}/api/public/erp-sync/${cfgQ.data.webhook_public_id}`
      : "";

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Integração ERP</h1>
        <p className="text-sm text-muted-foreground">
          Webhook seguro (HMAC) para receber vendas, compras e estoque do ERP e enviar releases de
          PLM.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Endpoint do webhook (ERP → PLM)</CardTitle>
          <CardDescription>
            Configure no seu ERP. Assine o corpo cru com HMAC-SHA256 usando a secret{" "}
            <code>ERP_WEBHOOK_SECRET</code> e envie o hash hex no header{" "}
            <code>x-erp-signature</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => regenMut.mutate()}
              disabled={regenMut.isPending}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Payload aceito:{" "}
            <code>{`{ "events": [{ "type": "sale|purchase|inventory", "data": {...} }] }`}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração de envio (PLM → ERP)</CardTitle>
          <CardDescription>
            Endpoint do ERP onde o PLM envia releases (ex: ficha aprovada → item master).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome do ERP</Label>
              <Input
                value={erpName}
                onChange={(e) => setErpName(e.target.value)}
                placeholder="ex: TOTVS Protheus"
              />
            </div>
            <div>
              <Label>URL do ERP</Label>
              <Input
                value={erpEndpoint}
                onChange={(e) => setErpEndpoint(e.target.value)}
                placeholder="https://erp.exemplo.com/api/plm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Integração ativa</Label>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Stat
            icon={<ArrowDownToLine className="h-4 w-4" />}
            label="Último recebimento"
            value={fmt(cfgQ.data?.last_inbound_at)}
          />
          <Stat
            icon={<ArrowUpFromLine className="h-4 w-4" />}
            label="Último envio"
            value={fmt(cfgQ.data?.last_outbound_at)}
          />
          <Stat
            icon={<AlertCircle className="h-4 w-4" />}
            label="Último erro"
            value={cfgQ.data?.last_error ?? "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recentes</CardTitle>
          <CardDescription>Últimas 50 sincronizações em qualquer direção.</CardDescription>
        </CardHeader>
        <CardContent>
          {logsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-2">
              {(logsQ.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
              )}
              {(logsQ.data ?? []).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex items-center gap-3">
                    {l.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : l.status === "erro" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                    <Badge variant="outline">{l.direction}</Badge>
                    <span className="font-medium">{l.event_type}</span>
                    {l.entity_type && (
                      <span className="text-muted-foreground">· {l.entity_type}</span>
                    )}
                    {l.records_affected ? (
                      <span className="text-muted-foreground">
                        · {l.records_affected} registros
                      </span>
                    ) : null}
                    {l.error_message && (
                      <span className="text-red-500 text-xs">— {l.error_message}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{fmt(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 border rounded">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-medium truncate">{value}</p>
    </div>
  );
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
}
