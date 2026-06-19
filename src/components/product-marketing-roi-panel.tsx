import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
import { Badge } from "@/components/ui/badge";
import {
  listProductMarketingRoi,
  type CollectionMarketingRoiRow,
  type ProductMarketingRoiRow,
} from "@/lib/product-marketing-roi.functions";

type CostType = "ensaio" | "foto" | "video" | "trafego" | "influencer" | "producao" | "outro";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  collection_id: string | null;
};

type CampaignOption = {
  id: string;
  name: string;
};

type ProductMarketingCost = {
  id: string;
  product_id: string;
  cost_type: CostType;
  amount: number;
  spent_at: string;
  notes: string | null;
  products: { sku: string; name: string } | null;
};

const COST_LABEL: Record<CostType, string> = {
  ensaio: "Ensaio",
  foto: "Foto",
  video: "Vídeo",
  trafego: "Tráfego",
  influencer: "Influencer",
  producao: "Produção",
  outro: "Outro",
};

const VERDICT_LABEL: Record<ProductMarketingRoiRow["verdict"], string> = {
  escalar: "Escalar",
  manter: "Manter",
  corrigir: "Corrigir",
  sem_dados: "Sem dados",
};

const VERDICT_CLASS: Record<ProductMarketingRoiRow["verdict"], string> = {
  escalar: "bg-success/15 text-success border-success/25",
  manter: "bg-primary/15 text-primary border-primary/25",
  corrigir: "bg-warning/15 text-warning border-warning/25",
  sem_dados: "bg-muted text-muted-foreground border-border",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(0)}%`);
const mult = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}x`);

export function ProductMarketingRoiPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listRoi = useServerFn(listProductMarketingRoi);
  const [days, setDays] = useState(90);
  const [productId, setProductId] = useState("");
  const [campaignId, setCampaignId] = useState("none");
  const [costType, setCostType] = useState<CostType>("trafego");
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const roiQuery = useQuery({
    queryKey: ["product-marketing-roi", days],
    queryFn: () => listRoi({ data: { days } }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["product-options-for-marketing-roi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, collection_id")
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ProductOption[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaign-options-for-marketing-roi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as CampaignOption[];
    },
  });

  const { data: recentCosts = [] } = useQuery({
    queryKey: ["product-marketing-costs-recent", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("product_marketing_costs" as "products")
        .select("id, product_id, cost_type, amount, spent_at, notes, products(sku, name)")
        .gte("spent_at", since)
        .order("spent_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ProductMarketingCost[];
    },
  });

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [products, productId],
  );

  const addCost = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      if (!selectedProduct) throw new Error("Selecione um produto");
      const value = Number(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("product_marketing_costs" as "products").insert({
        owner_id: user.id,
        product_id: selectedProduct.id,
        collection_id: selectedProduct.collection_id,
        campaign_id: campaignId === "none" ? null : campaignId,
        cost_type: costType,
        amount: value,
        spent_at: spentAt,
        notes: notes.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Custo atribuído ao produto");
      setAmount("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["product-marketing-roi"] });
      qc.invalidateQueries({ queryKey: ["product-marketing-costs-recent"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_marketing_costs" as "products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Custo removido");
      qc.invalidateQueries({ queryKey: ["product-marketing-roi"] });
      qc.invalidateQueries({ queryKey: ["product-marketing-costs-recent"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const result = roiQuery.data;
  const summary = result?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        {[30, 90, 180, 365].map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={days === option ? "default" : "outline"}
            onClick={() => setDays(option)}
          >
            {option}d
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={() => roiQuery.refetch()}
          disabled={roiQuery.isFetching}
        >
          <RefreshCw className={`size-3.5 ${roiQuery.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Receita ERP" value={brl(summary?.revenue ?? 0)} icon={TrendingUp} />
        <Metric
          label="Custo marketing"
          value={brl(summary?.marketingCost ?? 0)}
          icon={BadgeDollarSign}
        />
        <Metric label="Lucro líquido" value={brl(summary?.netProfit ?? 0)} icon={CheckCircle2} />
        <Metric label="ROI marketing" value={pct(summary?.roiPct ?? null)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <RoiTable rows={result?.rows ?? []} loading={roiQuery.isLoading} />
          <CollectionTable rows={result?.collections ?? []} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Atribuir custo ao produto</h3>
              <p className="text-xs text-muted-foreground">
                Use para ratear ensaio, foto, tráfego ou influencer em SKU específico.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um SKU" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={costType} onValueChange={(value) => setCostType(value as CostType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COST_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={spentAt}
                  onChange={(event) => setSpentAt(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Campanha</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem campanha</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: rateio do shooting verão"
              />
            </div>
            <Button
              className="w-full gap-1"
              onClick={() => addCost.mutate()}
              disabled={addCost.isPending}
            >
              <Plus className="size-4" />
              Adicionar custo
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Custos recentes</h3>
            <div className="space-y-2">
              {recentCosts.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-xs text-center text-muted-foreground">
                  Nenhum custo atribuído nesta janela.
                </div>
              )}
              {recentCosts.map((cost) => (
                <div
                  key={cost.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {cost.products?.sku ?? "—"} · {cost.products?.name ?? "Produto"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {COST_LABEL[cost.cost_type]} ·{" "}
                      {new Date(cost.spent_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {brl(Number(cost.amount))}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    onClick={() => deleteCost.mutate(cost.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RoiTable({ rows, loading }: { rows: ProductMarketingRoiRow[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border p-4 text-sm font-semibold">ROI por produto</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-right">Un.</th>
              <th className="px-3 py-2 text-right">Receita</th>
              <th className="px-3 py-2 text-right">Mkt</th>
              <th className="px-3 py-2 text-right">Lucro</th>
              <th className="px-3 py-2 text-right">ROAS</th>
              <th className="px-3 py-2 text-right">ROI</th>
              <th className="px-3 py-2 text-left">Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Calculando ROI…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Sem vendas ERP ou custos atribuídos nesta janela.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.productId} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.sku} · {row.collectionName ?? "Sem coleção"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{row.units}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(row.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(row.marketingCost)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {brl(row.netProfit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{mult(row.roas)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(row.roiPct)}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={VERDICT_CLASS[row.verdict]}>
                    {VERDICT_LABEL[row.verdict]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollectionTable({ rows }: { rows: CollectionMarketingRoiRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border p-4 text-sm font-semibold">ROI por coleção</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Coleção</th>
              <th className="px-3 py-2 text-right">SKUs</th>
              <th className="px-3 py-2 text-right">Receita</th>
              <th className="px-3 py-2 text-right">Mkt</th>
              <th className="px-3 py-2 text-right">Lucro</th>
              <th className="px-3 py-2 text-right">ROAS</th>
              <th className="px-3 py-2 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.collectionId} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{row.collectionName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.products}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(row.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(row.marketingCost)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {brl(row.netProfit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{mult(row.roas)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(row.roiPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
