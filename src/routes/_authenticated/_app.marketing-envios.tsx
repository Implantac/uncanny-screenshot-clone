import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { suggestShipments, type ShipmentSuggestion } from "@/lib/influencer-shipments.functions";
import { Send, Sparkles, TrendingUp, TrendingDown, Package, Plus, X, ExternalLink, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/marketing-envios")({
  component: MarketingEnvios,
});

type Shipment = {
  id: string;
  influencer_id: string;
  collection_id: string | null;
  product_id: string | null;
  quantity: number;
  status: string;
  shipped_at: string | null;
  posted_at: string | null;
  post_url: string | null;
  region: string | null;
  sales_before: number;
  sales_after: number;
  notes: string | null;
  influencers: { nome: string; estado: string | null; foto_url: string | null } | null;
  collections: { name: string; season: string | null; year: number | null } | null;
  products: { name: string; sku: string | null; image_url: string | null } | null;
};

async function loadAll() {
  const [{ data: shipments }, { data: collections }, { data: influencers }, { data: products }] = await Promise.all([
    supabase.from("influencer_shipments").select(`
      *,
      influencers (nome, estado, foto_url),
      collections (name, season, year),
      products (name, sku, image_url)
    `).order("created_at", { ascending: false }).limit(200),
    supabase.from("collections").select("id, name, season, year, created_at").order("created_at", { ascending: false }).limit(60),
    supabase.from("influencers").select("id, nome, estado").order("nome").limit(200),
    supabase.from("products").select("id, name, sku, collection_id").order("name").limit(500),
  ]);
  return {
    shipments: (shipments ?? []) as Shipment[],
    collections: collections ?? [],
    influencers: influencers ?? [],
    products: products ?? [],
  };
}

function MarketingEnvios() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["mkt-envios"], queryFn: loadAll });
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [aiSuggestions, setAiSuggestions] = useState<ShipmentSuggestion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const suggestFn = useServerFn(suggestShipments);

  const aiMutation = useMutation({
    mutationFn: async (collection_id: string) => suggestFn({ data: { collection_id } }),
    onSuccess: (res) => {
      setAiSuggestions(res.suggestions);
      if (!res.suggestions.length) toast.info("Sem sugestões disponíveis para esta coleção.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar sugestões"),
  });

  const createShipment = useMutation({
    mutationFn: async (input: Partial<Shipment> & { influencer_id: string }) => {
      const { error } = await supabase.from("influencer_shipments").insert({
        influencer_id: input.influencer_id,
        collection_id: input.collection_id,
        product_id: input.product_id,
        quantity: input.quantity ?? 1,
        status: input.status ?? "pendente",
        region: input.region,
        notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-envios"] });
      toast.success("Envio registrado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Shipment> }) => {
      const { error } = await supabase.from("influencer_shipments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mkt-envios"] }),
  });

  const newCollections = useMemo(() => {
    const cutoff = Date.now() - 14 * 86400000;
    const sent = new Set((data?.shipments ?? []).map((s) => s.collection_id));
    return (data?.collections ?? []).filter((c) => new Date(c.created_at).getTime() > cutoff && !sent.has(c.id));
  }, [data]);

  const upliftChart = useMemo(() => {
    return (data?.shipments ?? [])
      .filter((s) => s.posted_at)
      .slice(0, 12)
      .map((s) => ({
        name: (s.influencers?.nome ?? "—").slice(0, 14),
        antes: Number(s.sales_before),
        depois: Number(s.sales_after),
      }))
      .reverse();
  }, [data]);

  const kpi = useMemo(() => {
    const list = data?.shipments ?? [];
    const totalUplift = list.reduce((s, x) => s + (Number(x.sales_after) - Number(x.sales_before)), 0);
    return {
      total: list.length,
      enviados: list.filter((s) => s.status === "enviado" || s.status === "entregue" || s.status === "postado").length,
      postados: list.filter((s) => s.status === "postado").length,
      uplift: totalUplift,
    };
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Send className="size-6 text-primary" /> Envios para Influencers</h1>
          <p className="text-sm text-muted-foreground">Controle das peças enviadas, performance pós-postagem e sugestões da IA por coleção.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />} {showForm ? "Fechar" : "Novo envio"}
        </button>
      </header>

      {/* Novas coleções: alerta IA */}
      {newCollections.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
            <Sparkles className="size-4" /> Novas coleções aguardando envio
          </div>
          <div className="flex flex-wrap gap-2">
            {newCollections.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedCollection(c.id); aiMutation.mutate(c.id); }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted text-left"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.season} {c.year} · gerar sugestões IA</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total de envios" value={kpi.total} icon={<Package className="size-4" />} />
        <KPI label="Enviados/entregues" value={kpi.enviados} icon={<Send className="size-4" />} />
        <KPI label="Postados" value={kpi.postados} icon={<TrendingUp className="size-4" />} />
        <KPI label="Uplift total" value={`R$ ${kpi.uplift.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={kpi.uplift >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} tone={kpi.uplift >= 0 ? "success" : "destructive"} />
      </div>

      {/* Sugestões IA */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-primary" /> Sugestões da IA</div>
          <div className="flex items-center gap-2">
            <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className="text-xs bg-background border border-border rounded px-2 py-1">
              <option value="">Selecione uma coleção…</option>
              {(data?.collections ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              disabled={!selectedCollection || aiMutation.isPending}
              onClick={() => selectedCollection && aiMutation.mutate(selectedCollection)}
              className="inline-flex items-center gap-1 text-xs rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
            >
              {aiMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} Gerar
            </button>
          </div>
        </div>
        {aiSuggestions.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Selecione uma coleção e clique em Gerar para receber sugestões personalizadas.</div>
        ) : (
          <div className="divide-y divide-border">
            {aiSuggestions.map((s, idx) => (
              <div key={idx} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-12 md:col-span-3 font-medium">{s.product_name} <span className="text-xs text-muted-foreground">{s.product_sku}</span></div>
                <div className="col-span-6 md:col-span-3">→ {s.influencer_name} <span className="text-xs text-muted-foreground">{s.region ?? ""}</span></div>
                <div className="col-span-6 md:col-span-4 text-xs text-muted-foreground">{s.reason}</div>
                <div className="col-span-6 md:col-span-1 text-right font-semibold">{s.score}</div>
                <div className="col-span-6 md:col-span-1 text-right">
                  <button
                    onClick={() => createShipment.mutate({ influencer_id: s.influencer_id, product_id: s.product_id, collection_id: selectedCollection, region: s.region ?? undefined, notes: `IA: ${s.reason}` })}
                    className="text-xs rounded bg-primary/10 text-primary px-2 py-1 hover:bg-primary/20"
                  >Enviar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Novo envio manual */}
      {showForm && data && (
        <NewShipmentForm
          collections={data.collections}
          influencers={data.influencers}
          products={data.products}
          onSubmit={(payload) => { createShipment.mutate(payload); setShowForm(false); }}
        />
      )}

      {/* Gráfico antes/depois */}
      {upliftChart.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2"><TrendingUp className="size-4" /> Vendas antes vs depois da divulgação</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={upliftChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="antes" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="depois" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lista de envios */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium">Histórico de envios</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Influencer</th>
              <th className="text-left px-3 py-2">Coleção</th>
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-center px-3 py-2">Qtd</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Antes</th>
              <th className="text-right px-3 py-2">Depois</th>
              <th className="text-right px-3 py-2">Uplift</th>
              <th className="text-center px-3 py-2">Post</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && (data?.shipments.length ?? 0) === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum envio registrado.</td></tr>}
            {(data?.shipments ?? []).map((s) => {
              const uplift = Number(s.sales_after) - Number(s.sales_before);
              return (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">{s.influencers?.nome ?? "—"} <span className="text-xs text-muted-foreground">{s.influencers?.estado ?? ""}</span></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{s.collections?.name ?? "—"}</td>
                  <td className="px-3 py-2">{s.products?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{s.quantity}</td>
                  <td className="px-3 py-2">
                    <select
                      value={s.status}
                      onChange={(e) => updateStatus.mutate({ id: s.id, patch: { status: e.target.value, ...(e.target.value === "enviado" && !s.shipped_at ? { shipped_at: new Date().toISOString().slice(0, 10) } : {}), ...(e.target.value === "postado" && !s.posted_at ? { posted_at: new Date().toISOString().slice(0, 10) } : {}) } })}
                      className="text-xs bg-background border border-border rounded px-2 py-1"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregue">Entregue</option>
                      <option value="postado">Postado</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {Number(s.sales_before).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {Number(s.sales_after).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${uplift > 0 ? "text-emerald-600 dark:text-emerald-400" : uplift < 0 ? "text-destructive" : ""}`}>
                    R$ {uplift.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {s.post_url ? <a href={s.post_url} target="_blank" rel="noreferrer" className="text-primary inline-flex"><ExternalLink className="size-4" /></a> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "success" | "destructive" }) {
  const cls = tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function NewShipmentForm({
  collections, influencers, products, onSubmit,
}: {
  collections: { id: string; name: string }[];
  influencers: { id: string; nome: string; estado: string | null }[];
  products: { id: string; name: string; sku: string | null; collection_id: string | null }[];
  onSubmit: (payload: { influencer_id: string; collection_id?: string; product_id?: string; quantity: number; region?: string; notes?: string }) => void;
}) {
  const [influencer_id, setI] = useState("");
  const [collection_id, setC] = useState("");
  const [product_id, setP] = useState("");
  const [quantity, setQ] = useState(1);
  const [notes, setN] = useState("");

  const filteredProducts = collection_id ? products.filter((p) => p.collection_id === collection_id) : products;
  const inf = influencers.find((i) => i.id === influencer_id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!influencer_id) return;
        onSubmit({ influencer_id, collection_id: collection_id || undefined, product_id: product_id || undefined, quantity, region: inf?.estado ?? undefined, notes: notes || undefined });
      }}
      className="rounded-xl border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
    >
      <Field label="Influencer">
        <select required value={influencer_id} onChange={(e) => setI(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded">
          <option value="">—</option>
          {influencers.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
      </Field>
      <Field label="Coleção">
        <select value={collection_id} onChange={(e) => { setC(e.target.value); setP(""); }} className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded">
          <option value="">—</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Produto">
        <select value={product_id} onChange={(e) => setP(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded">
          <option value="">—</option>
          {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Qtd">
        <input type="number" min={1} value={quantity} onChange={(e) => setQ(Number(e.target.value))} className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded" />
      </Field>
      <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Registrar envio</button>
      <div className="md:col-span-5">
        <Field label="Observações">
          <input value={notes} onChange={(e) => setN(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded" />
        </Field>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs space-y-1">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
