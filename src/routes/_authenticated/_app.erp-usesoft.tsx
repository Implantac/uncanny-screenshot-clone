import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Database,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Tag,
  Package,
  Users,
  Building2,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usesoftHealth,
  usesoftKpis,
  usesoftListCollections,
  usesoftListProducts,
  usesoftListCustomers,
  usesoftListSuppliers,
  usesoftListSales,
  usesoftListPurchases,
  usesoftListInventory,
} from "@/lib/usesoft.functions";
import {
 syncErpCollections,
 getErpCollectionSyncStatus,
 syncErpProducts,
 getErpProductSyncStatus,
 syncErpCustomers,
 getErpCustomerSyncStatus,
 syncErpSuppliers,
 getErpSupplierSyncStatus,
 syncErpInventory,
 getErpInventorySyncStatus,
 syncErpSales,
 getErpSalesSyncStatus,
 syncErpPurchases,
 getErpPurchaseSyncStatus,
} from "@/lib/erp-import.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/erp-usesoft")({
  head: () => ({
    meta: [
      { title: "ERP Usesoft (Live) · USE MODA PLM" },
      {
        name: "description",
        content:
          "Leitura ao vivo do ERP Usesoft — coleções (grifes), produtos, clientes, fornecedores, vendas, compras e estoque. Read-only.",
      },
    ],
  }),
  component: ErpUsesoftPage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR");

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function ErpUsesoftPage() {
  const health = useServerFn(usesoftHealth);
  const kpis = useServerFn(usesoftKpis);
  const qc = useQueryClient();

  const healthQ = useQuery({ queryKey: ["usesoft-health"], queryFn: () => health() });
  const kpisQ = useQuery({ queryKey: ["usesoft-kpis"], queryFn: () => kpis() });

  const syncCol = useServerFn(syncErpCollections);
  const syncProd = useServerFn(syncErpProducts);
  const syncCust = useServerFn(syncErpCustomers);
  const syncSup = useServerFn(syncErpSuppliers);
  const syncInv = useServerFn(syncErpInventory);
  const syncSales = useServerFn(syncErpSales);
  const syncPur = useServerFn(syncErpPurchases);
  const [syncingAll, setSyncingAll] = useState(false);

  async function handleSyncAll() {
    setSyncingAll(true);
    const steps: Array<[string, () => Promise<{ inserted?: number; updated?: number; total_erp?: number }>]> = [
      ["Coleções", () => syncCol()],
      ["Produtos", () => syncProd()],
      ["Clientes", () => syncCust()],
      ["Fornecedores", () => syncSup()],
      ["Estoque", () => syncInv()],
      ["Vendas (90d)", () => syncSales({ data: { daysBack: 90 } })],
      ["Compras (180d)", () => syncPur({ data: { daysBack: 180 } })],
    ];
    let ok = 0, fail = 0;
    for (const [label, fn] of steps) {
      try {
        const r = await fn();
        toast.success(`${label}: ${r.inserted ?? 0} criados, ${r.updated ?? 0} atualizados`);
        ok++;
      } catch (e) {
        toast.error(`${label}: ${e instanceof Error ? e.message : "falhou"}`);
        fail++;
      }
    }
    qc.invalidateQueries();
    setSyncingAll(false);
    if (!fail) toast.success(`Sincronização completa — ${ok} etapas OK`);
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Database className="h-6 w-6" />
            ERP Usesoft · Live
          </h1>
          <p className="text-sm text-muted-foreground">
            Leitura ao vivo do banco do ERP — sessão Postgres em modo{" "}
            <code>read-only</code>. Nenhuma operação de escrita é possível por
            construção.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {healthQ.data?.ok ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Conectado · {healthQ.data.latency_ms}ms
            </Badge>
          ) : healthQ.isLoading ? (
            <Badge variant="outline">Verificando…</Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3.5 w-3.5" />
              {healthQ.data?.error ?? "Falha"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              healthQ.refetch();
              kpisQ.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleSyncAll} disabled={syncingAll || !healthQ.data?.ok} size="sm">
            <PlayCircle className={`h-4 w-4 mr-2 ${syncingAll ? "animate-pulse" : ""}`} />
            {syncingAll ? "Sincronizando tudo…" : "Sincronizar tudo"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<Tag className="h-4 w-4" />} label="Coleções (Grifes)" value={kpisQ.data?.colecoes} />
        <Kpi icon={<Package className="h-4 w-4" />} label="Produtos ativos" value={kpisQ.data?.produtos} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Clientes ativos" value={kpisQ.data?.clientes} />
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Fornecedores" value={kpisQ.data?.fornecedores} />
        <Kpi icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos · 30d" value={kpisQ.data?.pedidos30d} />
        <Kpi icon={<Truck className="h-4 w-4" />} label="Compras · 30d" value={kpisQ.data?.compras30d} />
      </div>

      <Tabs defaultValue="colecoes">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="colecoes">Coleções (Grifes)</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        </TabsList>

        <TabsContent value="colecoes" className="mt-4"><CollectionsPanel /></TabsContent>
        <TabsContent value="produtos" className="mt-4"><ProductsPanel /></TabsContent>
        <TabsContent value="estoque" className="mt-4"><InventoryPanel /></TabsContent>
        <TabsContent value="vendas" className="mt-4"><SalesPanel /></TabsContent>
        <TabsContent value="compras" className="mt-4"><PurchasesPanel /></TabsContent>
        <TabsContent value="clientes" className="mt-4"><CustomersPanel /></TabsContent>
        <TabsContent value="fornecedores" className="mt-4"><SuppliersPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {value == null ? "—" : NUM.format(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

function TableShell({
  title,
  description,
  search,
  setSearch,
  searchPlaceholder,
  children,
  isLoading,
  isFetching,
  empty,
  error,
}: {
  title: string;
  description: string;
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder: string;
  children: React.ReactNode;
  isLoading: boolean;
  isFetching?: boolean;
  empty: boolean;
  error: Error | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="w-full md:w-72">
            <SearchBar value={search} onChange={setSearch} placeholder={searchPlaceholder} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-500">Erro: {error.message}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando do Usesoft…</p>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">
            Nenhum registro encontrado{search ? ` para “${search}”` : ""}.
          </p>
        ) : (
          <>
            {isFetching && (
              <p className="text-xs text-muted-foreground mb-2">Atualizando…</p>
            )}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ----- Painéis ------------------------------------------------------------

function CollectionsPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListCollections);
  const syncFn = useServerFn(syncErpCollections);
  const statusFn = useServerFn(getErpCollectionSyncStatus);
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const q = useQuery({
    queryKey: ["usesoft-collections", search],
    queryFn: () => fn({ data: { search, limit: 200, offset: 0 } }),
  });
  const statusQ = useQuery({
    queryKey: ["erp-collections-sync-status"],
    queryFn: () => statusFn(),
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncFn();
      toast.success(
        `Sincronização concluída: ${res.inserted} criadas, ${res.updated} atualizadas (${res.total_erp} no ERP).`,
      );
      qc.invalidateQueries({ queryKey: ["erp-collections-sync-status"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const linked = statusQ.data?.linked ?? 0;
  const lastSync = statusQ.data?.lastSync;

  return (
    <TableShell
      title="Coleções (Grifes)"
      description="solgrife — Grife é como o Usesoft chama coleção. Use Moda usa este vínculo para agrupar produtos."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar grife…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <div className="font-medium">
            {linked} coleção(ões) vinculada(s) ao ERP
          </div>
          <div className="text-xs text-muted-foreground">
            {lastSync
              ? `Último sync: ${new Date(lastSync.created_at).toLocaleString("pt-BR")} — ${lastSync.records_affected ?? 0} registros`
              : "Nunca sincronizado. ERP é fonte da verdade (read-only)."}
          </div>
        </div>
        <Button onClick={handleSync} disabled={syncing} size="sm">
          <Download className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
          {syncing ? "Sincronizando…" : "Sincronizar do ERP"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">ID</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-32">E-commerce</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data ?? []).map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.id}</TableCell>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell>
                <Badge variant={c.status === "ativa" ? "default" : "secondary"}>
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell>
                {c.visivelEcommerce ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                    visível
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">oculto</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function ProductsPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListProducts);
  const syncFn = useServerFn(syncErpProducts);
  const statusFn = useServerFn(getErpProductSyncStatus);
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const q = useQuery({
    queryKey: ["usesoft-products", search],
    queryFn: () =>
      fn({ data: { search, limit: 200, offset: 0, onlyActive: true } }),
  });
  const statusQ = useQuery({
    queryKey: ["erp-products-sync-status"],
    queryFn: () => statusFn(),
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncFn();
      toast.success(
        `Produtos sincronizados: ${res.inserted} criados, ${res.updated} atualizados (${res.total_erp} no ERP).`,
      );
      qc.invalidateQueries({ queryKey: ["erp-products-sync-status"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar produtos");
    } finally {
      setSyncing(false);
    }
  }

  const linked = statusQ.data?.linked ?? 0;
  const lastSync = statusQ.data?.lastSync;

  return (
    <TableShell
      title="Produtos"
      description="solprodu — produtos ativos. Custo, preço e vínculo com coleção (grife)."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar nome, código ou EAN…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <div className="font-medium">
            {linked} produto(s) vinculado(s) ao ERP
          </div>
          <div className="text-xs text-muted-foreground">
            {lastSync
              ? `Último sync: ${new Date(lastSync.created_at).toLocaleString("pt-BR")} — ${lastSync.records_affected ?? 0} registros`
              : "Nunca sincronizado. Sincronize coleções primeiro para auto-vincular produtos por grife."}
          </div>
        </div>
        <Button onClick={handleSync} disabled={syncing} size="sm">
          <Download className={`h-4 w-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
          {syncing ? "Sincronizando…" : "Sincronizar do ERP"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Coleção (grife)</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Preço venda</TableHead>
              <TableHead>EAN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.codigo ?? p.id}</TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.grifeNome ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{BRL.format(p.custo)}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL.format(p.precoVenda)}</TableCell>
                <TableCell className="font-mono text-xs">{p.ean ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableShell>
  );
}

function InventoryPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListInventory);
  const q = useQuery({
    queryKey: ["usesoft-inventory", search],
    queryFn: () =>
      fn({ data: { search, limit: 200, offset: 0, onlyWithBalance: true } }),
  });
  return (
    <TableShell
      title="Estoque (saldo consolidado)"
      description="estsaldo — saldo somado por todos os almoxarifados, para produtos com saldo > 0."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar produto…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Valor em estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((i) => (
              <TableRow key={i.produtoId}>
                <TableCell className="font-mono text-xs">{i.codigo ?? i.produtoId}</TableCell>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell className="text-right tabular-nums">{NUM.format(i.saldo)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {i.custoMedio == null ? "—" : BRL.format(i.custoMedio)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {i.precoVenda == null ? "—" : BRL.format(i.precoVenda)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {i.custoMedio == null ? "—" : BRL.format(i.custoMedio * i.saldo)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableShell>
  );
}

function SalesPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListSales);
  const q = useQuery({
    queryKey: ["usesoft-sales", search],
    queryFn: () =>
      fn({ data: { search, limit: 200, offset: 0, daysBack: 90 } }),
  });
  return (
    <TableShell
      title="Vendas · últimos 90 dias"
      description="solpedid + solitped — pedidos por data, valor, cliente e quantidade de itens."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar cliente…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Pedido</TableHead>
              <TableHead className="w-28">Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((s) => (
              <TableRow key={s.pedidoId}>
                <TableCell className="font-mono text-xs">{s.numero}</TableCell>
                <TableCell>{fmtDate(s.data)}</TableCell>
                <TableCell className="font-medium">{s.clienteNome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{s.quantidadeItens}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL.format(s.valorTotal)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{s.status ?? "—"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableShell>
  );
}

function PurchasesPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListPurchases);
  const q = useQuery({
    queryKey: ["usesoft-purchases", search],
    queryFn: () =>
      fn({ data: { search, limit: 200, offset: 0, daysBack: 180 } }),
  });
  return (
    <TableShell
      title="Compras · últimos 180 dias"
      description="solpedcom — pedidos de compra por fornecedor."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar fornecedor…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">PO</TableHead>
              <TableHead className="w-28">Data</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((p) => (
              <TableRow key={p.pedidoId}>
                <TableCell className="font-mono text-xs">{p.numero}</TableCell>
                <TableCell>{fmtDate(p.data)}</TableCell>
                <TableCell className="font-medium">{p.fornecedorNome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL.format(p.valorTotal)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{p.status ?? "—"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableShell>
  );
}

function CustomersPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListCustomers);
  const q = useQuery({
    queryKey: ["usesoft-customers", search],
    queryFn: () => fn({ data: { search, limit: 200, offset: 0 } }),
  });
  return (
    <TableShell
      title="Clientes"
      description="solclien — clientes ativos."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar nome, fantasia ou documento…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Nome / Fantasia</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.codigo?.trim() ?? c.id}</TableCell>
                <TableCell>
                  <div className="font-medium">{c.nome}</div>
                  {c.nomeFantasia && (
                    <div className="text-xs text-muted-foreground">{c.nomeFantasia}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{c.documento ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[c.email, c.telefone].filter(Boolean).join(" · ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableShell>
  );
}

function SuppliersPanel() {
  const [search, setSearch] = useState("");
  const fn = useServerFn(usesoftListSuppliers);
  const q = useQuery({
    queryKey: ["usesoft-suppliers", search],
    queryFn: () => fn({ data: { search, limit: 200, offset: 0 } }),
  });
  return (
    <TableShell
      title="Fornecedores"
      description="solforne — fornecedores ativos."
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Buscar nome, fantasia ou CNPJ…"
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      empty={(q.data ?? []).length === 0}
      error={q.error as Error | null}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Nome / Fantasia</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-xs">{f.codigo?.trim() ?? f.id}</TableCell>
                <TableCell>
                  <div className="font-medium">{f.nome}</div>
                  {f.nomeFantasia && (
                    <div className="text-xs text-muted-foreground">{f.nomeFantasia}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{f.documento ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[f.email, f.telefone].filter(Boolean).join(" · ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableShell>
  );
}
