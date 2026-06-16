import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  Clock3,
  Copy,
  Download,
  Flag,
  ImagePlus,
  Layers,
  Palette,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const STATUS_KEYS = ["briefing", "design", "desenvolvimento", "producao", "entregue"] as const;
const SORT_KEYS = ["recent", "name", "progress", "launch", "year"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const colecoesSearchSchema = z.object({
  q: fallback(z.string().trim().max(80), "").default(""),
  status: fallback(z.enum(["all", ...STATUS_KEYS]), "all").default("all"),
  season: fallback(
    z.string().trim().max(40).regex(/^[\p{L}\p{N}\s\-–]+$/u),
    "all",
  ).default("all"),
  sort: fallback(z.enum(SORT_KEYS), "recent").default("recent"),
  page: fallback(z.coerce.number().int().min(1).max(9999), 1).default(1),
  id: fallback(z.string().regex(UUID_RE).optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/_app/colecoes")({
  validateSearch: zodValidator(colecoesSearchSchema),
  head: () => ({
    meta: [
      { title: "Coleções · USE MODA OS" },
      { name: "description", content: "Gestão de coleções com visão de planejamento, mix, performance e rentabilidade." },
    ],
  }),
  component: ColecoesPage,
});

type Collection = {
  id: string;
  owner_id: string;
  name: string;
  season: string;
  year: number;
  status: "briefing" | "design" | "desenvolvimento" | "producao" | "entregue";
  description: string | null;
  palette: string[];
  launch_date: string | null;
  progress: number;
  cover_path: string | null;
  created_at: string;
};

type ProductRef = {
  id: string;
  collection_id: string | null;
  name: string;
  category: string | null;
  status: string;
  sell_price: number;
  cost_price: number;
  colors: string[];
  created_at: string;
};

const STATUS_LABELS: Record<Collection["status"], string> = {
  briefing: "Briefing",
  design: "Design",
  desenvolvimento: "Desenvolvimento",
  producao: "Produção",
  entregue: "Entregue",
};

const STATUS_COLORS: Record<Collection["status"], string> = {
  briefing: "bg-muted text-muted-foreground",
  design: "bg-info/20 text-info border-info/30",
  desenvolvimento: "bg-warning/20 text-warning border-warning/30",
  producao: "bg-primary/20 text-primary border-primary/30",
  entregue: "bg-success/20 text-success border-success/30",
};

const STATUS_PROGRESS: Record<Collection["status"], number> = {
  briefing: 15,
  design: 35,
  desenvolvimento: 60,
  producao: 85,
  entregue: 100,
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

async function resolveCoverUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("collection-covers").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

function CollectionCover({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ["collection-cover", path],
    queryFn: () => resolveCoverUrl(path),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
  });

  if (!path || !url) {
    return (
      <div className={`glass ${className ?? ""} grid place-items-center`}>
        <Sparkles className="size-8 text-primary/70" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

function ColecoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useRealtime("collections", ["collections", "collection-products"]);

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { q, status: statusFilter, season: seasonFilter, sort: sortBy, page, id: selectedId } = search;
  const pageSize = 6;

  const updateSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });
  const setQ = (v: string) => updateSearch({ q: v, page: 1 });
  const setStatusFilter = (v: string) => updateSearch({ status: v, page: 1 });
  const setSeasonFilter = (v: string) => updateSearch({ season: v, page: 1 });
  const setSortBy = (v: typeof sortBy) => updateSearch({ sort: v, page: 1 });
  const setPage = (v: number | ((p: number) => number)) =>
    updateSearch({ page: typeof v === "function" ? v(page) : v });
  const setSelectedId = (v: string | null | ((cur: string | undefined) => string | undefined | null)) => {
    const next = typeof v === "function" ? v(selectedId) : v;
    updateSearch({ id: next ?? undefined });
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Collection[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["collection-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, collection_id, name, category, status, sell_price, cost_price, colors, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProductRef[];
    },
  });

  useEffect(() => {
    if (!collections.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && collections.some((item) => item.id === current) ? current : collections[0].id));
  }, [collections]);

  const selected = useMemo(
    () => collections.find((item) => item.id === selectedId) ?? collections[0] ?? null,
    [collections, selectedId],
  );

  const selectedProducts = useMemo(
    () => products.filter((item) => item.collection_id === selected?.id),
    [products, selected?.id],
  );

  const selectedProductIds = useMemo(() => selectedProducts.map((p) => p.id), [selectedProducts]);

  const { data: productionByProduct = {} } = useQuery({
    queryKey: ["collection-production", selected?.id, selectedProductIds.join(",")],
    enabled: selectedProductIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("product_id, quantity, progress, status, stage, due_date")
        .in("product_id", selectedProductIds);
      if (error) throw error;
      const map: Record<string, { qty: number; done: number; stages: Record<string, number>; late: number; status: Record<string, number> }> = {};
      const now = Date.now();
      (data ?? []).forEach((o: any) => {
        if (!o.product_id) return;
        const m = (map[o.product_id] ??= { qty: 0, done: 0, stages: {}, late: 0, status: {} });
        m.qty += o.quantity ?? 0;
        m.done += Math.round((o.quantity ?? 0) * ((o.progress ?? 0) / 100));
        if (o.stage) m.stages[o.stage] = (m.stages[o.stage] ?? 0) + (o.quantity ?? 0);
        if (o.status) m.status[o.status] = (m.status[o.status] ?? 0) + 1;
        if (o.due_date && new Date(o.due_date).getTime() < now && (o.progress ?? 0) < 100 && o.status !== "concluida") m.late += 1;
      });
      return map;
    },
  });

  const { data: productionAll = [] } = useQuery({
    queryKey: ["collections-production-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("product_id, quantity, progress, status, stage")
        .neq("status", "cancelada");
      if (error) throw error;
      return (data ?? []) as Array<{ product_id: string | null; quantity: number | null; progress: number | null; status: string | null; stage: string | null }>;
    },
  });

  const readinessByCollection = useMemo(() => {
    const productToCol = new Map(products.map((p) => [p.id, p.collection_id] as const));
    const agg = new Map<string, { planned: number; done: number; ops: number }>();
    productionAll.forEach((o) => {
      const col = o.product_id ? productToCol.get(o.product_id) : null;
      if (!col) return;
      const a = agg.get(col) ?? { planned: 0, done: 0, ops: 0 };
      const q = Number(o.quantity ?? 0);
      a.planned += q;
      a.done += Math.round(q * (Number(o.progress ?? 0) / 100));
      a.ops += 1;
      agg.set(col, a);
    });
    const map: Record<string, { planned: number; done: number; ops: number; pct: number }> = {};
    agg.forEach((v, k) => {
      map[k] = { ...v, pct: v.planned > 0 ? Math.round((v.done / v.planned) * 100) : 0 };
    });
    return map;
  }, [productionAll, products]);

  const { data: techSheets = [] } = useQuery({
    queryKey: ["collections-tech-sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheets")
        .select("id, product_id, status");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; product_id: string | null; status: string | null }>;
    },
  });

  const { data: bom = [] } = useQuery({
    queryKey: ["collections-bom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_sheet_materials")
        .select("tech_sheet_id, inventory_item_id, inventory_items(balance)");
      if (error) throw error;
      return (data ?? []) as Array<{ tech_sheet_id: string; inventory_item_id: string | null; inventory_items: { balance: number | null } | null }>;
    },
  });

  const devReadinessByCollection = useMemo(() => {
    const approvedSheets = techSheets.filter((t) => t.status === "aprovada" && t.product_id);
    const sheetsByProduct = new Map<string, string[]>();
    approvedSheets.forEach((t) => {
      const arr = sheetsByProduct.get(t.product_id!) ?? [];
      arr.push(t.id);
      sheetsByProduct.set(t.product_id!, arr);
    });
    const matsBySheet = new Map<string, typeof bom>();
    bom.forEach((m) => {
      const arr = matsBySheet.get(m.tech_sheet_id) ?? [];
      arr.push(m);
      matsBySheet.set(m.tech_sheet_id, arr);
    });
    const productMaterialsOk = (pid: string) => {
      const sheets = sheetsByProduct.get(pid);
      if (!sheets?.length) return false;
      return sheets.some((sid) => {
        const mats = matsBySheet.get(sid) ?? [];
        if (mats.length === 0) return true;
        return mats.every((m) => m.inventory_item_id && Number(m.inventory_items?.balance ?? 0) > 0);
      });
    };
    const map: Record<string, { total: number; sheetOk: number; matOk: number; pct: number }> = {};
    products.forEach((p) => {
      if (!p.collection_id) return;
      const a = (map[p.collection_id] ??= { total: 0, sheetOk: 0, matOk: 0, pct: 0 });
      a.total += 1;
      const hasSheet = sheetsByProduct.has(p.id);
      if (hasSheet) a.sheetOk += 1;
      if (hasSheet && productMaterialsOk(p.id)) a.matOk += 1;
    });
    Object.values(map).forEach((a) => { a.pct = a.total > 0 ? Math.round((a.matOk / a.total) * 100) : 0; });
    return map;
  }, [techSheets, bom, products]);




  const derived = useMemo(() => {
    const revenue = selectedProducts.reduce((sum, item) => sum + Number(item.sell_price || 0), 0);
    const cost = selectedProducts.reduce((sum, item) => sum + Number(item.cost_price || 0), 0);
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    const statusCount = selectedProducts.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const categoryCount = selectedProducts.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || "Sem categoria";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const colorCount = selectedProducts.flatMap((item) => item.colors ?? []).reduce<Record<string, number>>((acc, color) => {
      acc[color] = (acc[color] ?? 0) + 1;
      return acc;
    }, {});

    return {
      revenue,
      cost,
      margin,
      marginPct,
      categories: Object.entries(categoryCount).sort((a, b) => b[1] - a[1]),
      colors: Object.entries(colorCount).sort((a, b) => b[1] - a[1]),
      statusCount,
    };
  }, [selectedProducts]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Coleção removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateMut = useMutation({
    mutationFn: async (c: Collection) => {
      if (!user?.id) throw new Error("Sessão expirada");
      const { error } = await supabase.from("collections").insert({
        owner_id: user.id,
        name: `${c.name} (cópia)`,
        season: c.season,
        year: c.year,
        status: "briefing",
        description: c.description,
        palette: c.palette,
        launch_date: c.launch_date,
        progress: 0,
        cover_path: c.cover_path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Coleção duplicada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const seasons = useMemo(() => Array.from(new Set(collections.map((c) => c.season))).sort(), [collections]);

  const filteredCollections = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = collections.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (seasonFilter !== "all" && c.season !== seasonFilter) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.season.toLowerCase().includes(term) ||
        String(c.year).includes(term) ||
        (c.description ?? "").toLowerCase().includes(term)
      );
    });
    const sorted = [...list];
    const farFuture = 8640000000000000;
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name, "pt-BR");
        case "progress": return b.progress - a.progress;
        case "year": return b.year - a.year;
        case "launch": {
          const av = a.launch_date ? new Date(a.launch_date).getTime() : farFuture;
          const bv = b.launch_date ? new Date(b.launch_date).getTime() : farFuture;
          return av - bv;
        }
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [collections, q, statusFilter, seasonFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCollections.length / pageSize));
  useEffect(() => { setPage(1); }, [q, statusFilter, seasonFilter, sortBy]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pagedCollections = useMemo(
    () => filteredCollections.slice((page - 1) * pageSize, page * pageSize),
    [filteredCollections, page],
  );

  function exportSpec(c: Collection) {
    const items = products.filter((p) => p.collection_id === c.id);
    const revenue = items.reduce((s, i) => s + Number(i.sell_price || 0), 0);
    const cost = items.reduce((s, i) => s + Number(i.cost_price || 0), 0);
    const spec = {
      format: "USE-MODA-COLLECTION-SPEC/1.0",
      exported_at: new Date().toISOString(),
      collection: {
        id: c.id,
        name: c.name,
        season: c.season,
        year: c.year,
        status: c.status,
        description: c.description,
        palette: c.palette,
        launch_date: c.launch_date,
        progress: c.progress,
      },
      mix: {
        total: items.length,
        revenue,
        cost,
        margin: revenue - cost,
        products: items.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          status: p.status,
          sell_price: p.sell_price,
          cost_price: p.cost_price,
          colors: p.colors,
        })),
      },
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `colecao-${c.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Spec exportado");
  }


  const timeline = useMemo(() => {
    if (!selected) return [];
    const start = new Date(selected.created_at);
    const launch = selected.launch_date ? new Date(selected.launch_date) : new Date(start.getFullYear(), start.getMonth() + 4, start.getDate());
    const span = Math.max(10, Math.round((launch.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const steps = [
      { label: "Briefing", at: start, progress: 10 },
      { label: "Mix & direção", at: new Date(start.getTime() + span * 0.25 * 86400000), progress: 30 },
      { label: "Desenvolvimento", at: new Date(start.getTime() + span * 0.55 * 86400000), progress: 60 },
      { label: "Go to market", at: launch, progress: 100 },
    ];
    return steps;
  }, [selected]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(collection: Collection) {
    setEditing(collection);
    setOpen(true);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Módulo 2</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="size-6 text-primary" /> Gestão de Coleções
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Planejamento, direção criativa, mix, cronograma, performance e ROI em uma única visão.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Nova coleção
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : collections.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Nenhuma coleção cadastrada</h2>
          <p className="text-sm text-muted-foreground mb-4">Crie a primeira coleção para estruturar o calendário criativo do time.</p>
          <Button onClick={openCreate}>Criar coleção</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <section className="glass rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <div className="text-sm font-semibold">Portfólio sazonal</div>
                <div className="text-xs text-muted-foreground">
                  {filteredCollections.length} de {collections.length} coleções
                </div>
              </div>
              <Badge variant="outline">Notion-style</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, temporada, ano…"
                className="pl-8 pr-8 h-9"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Temporada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas temporadas</SelectItem>
                  {seasons.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
                <SelectItem value="progress">Maior progresso</SelectItem>
                <SelectItem value="launch">Lançamento mais próximo</SelectItem>
                <SelectItem value="year">Ano (desc)</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2">
              {filteredCollections.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6">Nenhuma coleção encontrada.</div>
              ) : pagedCollections.map((collection) => {
                const active = collection.id === selected?.id;
                return (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => setSelectedId(collection.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      active ? "border-primary/40 bg-primary/10" : "border-border bg-background/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{collection.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{collection.season} {collection.year}</div>
                      </div>
                      <Badge variant="outline" className={STATUS_COLORS[collection.status]}>{STATUS_LABELS[collection.status]}</Badge>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Progresso</span>
                        <span>{collection.progress}%</span>
                      </div>
                      <Progress value={collection.progress} className="h-1.5" />
                      {readinessByCollection[collection.id]?.planned > 0 && (
                        <>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span>Produção (real/plan)</span>
                            <span className="tabular-nums">{readinessByCollection[collection.id].pct}%</span>
                          </div>
                          <Progress value={readinessByCollection[collection.id].pct} className="h-1.5" />
                        </>
                      )}
                    </div>

                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <div className="text-xs text-muted-foreground tabular-nums">
                  Página {page} de {totalPages}
                </div>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Próxima
                </Button>
              </div>
            )}
          </section>



          {selected && (
            <section className="space-y-4">
              <div className="glass rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-0">
                  <div className="min-h-[280px] lg:min-h-[360px] relative bg-muted/20">
                    <CollectionCover path={selected.cover_path} alt={`Mood da coleção ${selected.name}`} className="size-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-background via-background/60 to-transparent">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge variant="outline" className={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                        <Badge variant="outline">{selected.season} {selected.year}</Badge>
                        <Badge variant="outline">{selectedProducts.length} SKUs</Badge>
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight">{selected.name}</h2>
                      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                        {selected.description || "Direção criativa ainda sem descrição estruturada."}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-2 gap-3 content-start">
                    {[
                      { label: "Receita potencial", value: brl(derived.revenue), icon: TrendingUp },
                      { label: "Margem estimada", value: brl(derived.margin), icon: Target },
                      { label: "Mix ativo", value: `${selectedProducts.length} produtos`, icon: BarChart3 },
                      { label: "Go-live", value: selected.launch_date ? new Date(selected.launch_date).toLocaleDateString("pt-BR") : "A definir", icon: Calendar },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-xl border border-border bg-background/30 p-4">
                          <Icon className="size-4 text-primary mb-3" />
                          <div className="text-lg font-semibold tracking-tight">{item.value}</div>
                          <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                        </div>
                      );
                    })}

                    {(() => {
                      const r = readinessByCollection[selected.id];
                      if (!r || r.planned <= 0) return null;
                      return (
                        <div className="col-span-2 rounded-xl border border-border bg-background/30 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Flag className="size-4 text-primary" />
                              <div className="text-sm font-medium">Pronta para lançamento</div>
                            </div>
                            <span className="text-lg font-semibold tabular-nums">{r.pct}%</span>
                          </div>
                          <Progress value={r.pct} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-2">
                            {r.done.toLocaleString("pt-BR")} de {r.planned.toLocaleString("pt-BR")} peças produzidas · {r.ops} OPs ativas
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const d = devReadinessByCollection[selected.id];
                      if (!d || d.total === 0) return null;
                      const ok = d.pct === 100;
                      return (
                        <div className="col-span-2 rounded-xl border border-border bg-background/30 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Target className="size-4 text-primary" />
                              <div className="text-sm font-medium">Pronta para entrar em produção</div>
                            </div>
                            <Badge variant="outline" className={ok ? "bg-success/20 text-success border-success/30" : "bg-warning/20 text-warning border-warning/30"}>
                              {ok ? "Liberada" : `${d.pct}%`}
                            </Badge>
                          </div>
                          <Progress value={d.pct} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-2">
                            {d.ready} de {d.total} produtos com ficha técnica aprovada
                            {!ok && ` · faltam ${d.total - d.ready}`}
                          </div>
                        </div>
                      );
                    })()}


                    <div className="col-span-2 rounded-xl border border-border bg-background/30 p-4 flex flex-wrap gap-2 items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Direção cromática</div>
                        <div className="text-xs text-muted-foreground">Paleta principal da coleção</div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {(selected.palette.length ? selected.palette : ["#a78bfa", "#fb7185", "#f59e0b"]).slice(0, 6).map((color) => (
                          <div key={color} className="size-7 rounded-full border border-border" style={{ background: color }} title={color} />
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <Tabs defaultValue="planejamento" className="space-y-4">
                <TabsList className="w-full flex flex-wrap h-auto justify-start bg-transparent p-0 gap-2">
                  {[
                    ["planejamento", "Planejamento"],
                    ["moodboard", "Moodboard"],
                    ["tendencias", "Tendências"],
                    ["mix", "Produtos"],
                    ["cronograma", "Cronograma"],
                    ["status", "Status"],
                    ["performance", "Performance"],
                    ["roi", "ROI"],
                  ].map(([value, label]) => (
                    <TabsTrigger key={value} value={value} className="rounded-lg border border-border bg-background/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="planejamento" className="mt-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 glass rounded-xl p-5 space-y-5">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2"><Flag className="size-4 text-primary" /> Plano mestre</div>
                      <div className="text-xs text-muted-foreground mt-1">Ponto de controle executivo desta coleção.</div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <Metric label="Meta de progresso" value={`${Math.max(selected.progress, STATUS_PROGRESS[selected.status])}%`} />
                      <Metric label="Categorias ativas" value={String(derived.categories.length)} />
                      <Metric label="Margem prevista" value={`${derived.marginPct.toFixed(0)}%`} />
                    </div>
                    <div className="space-y-3">
                      {[
                        ["Narrativa da coleção", selected.description || "Definir conceito e pilares criativos da temporada."],
                        ["Linha comercial", `${selectedProducts.length} produtos mapeados para entrada no calendário.`],
                        ["Ritmo de lançamento", selected.launch_date ? `Data-alvo ${new Date(selected.launch_date).toLocaleDateString("pt-BR")}.` : "Data de lançamento ainda pendente."],
                      ].map(([label, text]) => (
                        <div key={label} className="rounded-xl border border-border bg-background/30 p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">{label}</div>
                          <p className="text-sm leading-6">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 space-y-4">
                    <div className="text-sm font-semibold">Checklist do squad</div>
                    {[
                      { label: "Briefing consolidado", done: selected.progress >= 15 },
                      { label: "Mix priorizado", done: selectedProducts.length >= 3 },
                      { label: "Direção cromática validada", done: selected.palette.length >= 3 },
                      { label: "Go-live definido", done: Boolean(selected.launch_date) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-background/30 p-3 text-sm">
                        <span>{item.label}</span>
                        <Badge variant="outline" className={item.done ? "bg-success/20 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                          {item.done ? "OK" : "Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="moodboard" className="mt-0 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                  <div className="glass rounded-xl overflow-hidden min-h-[320px]">
                    <CollectionCover path={selected.cover_path} alt={`Imagem da coleção ${selected.name}`} className="size-full min-h-[320px] object-cover" />
                  </div>
                  <div className="glass rounded-xl p-5 space-y-5">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2"><Palette className="size-4 text-primary" /> Direção visual</div>
                      <div className="text-xs text-muted-foreground mt-1">Base criativa montada com os sinais já disponíveis no catálogo.</div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Paleta-chave</div>
                        <div className="flex flex-wrap gap-2">
                          {(selected.palette.length ? selected.palette : derived.colors.map(([color]) => color)).slice(0, 8).map((color) => (
                            <div key={color} className="w-14">
                              <div className="h-10 rounded-lg border border-border" style={{ background: color }} />
                              <div className="text-[10px] text-muted-foreground truncate mt-1">{color}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Categorias em foco</div>
                        <div className="flex flex-wrap gap-2">
                          {(derived.categories.length ? derived.categories : [["Sem dados", 0]]).slice(0, 6).map(([label, total]) => (
                            <Badge key={label} variant="secondary">{label} · {total}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tendencias" className="mt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-5 space-y-3">
                    <div className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Cores em alta na coleção</div>
                    {derived.colors.length ? derived.colors.slice(0, 8).map(([color, n]) => {
                      const max = derived.colors[0]?.[1] || 1;
                      return (
                        <div key={color} className="flex items-center gap-2 text-xs">
                          <div className="size-4 rounded border border-border" style={{ background: color }} />
                          <span className="w-24 truncate">{color}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${(n / max) * 100}%` }} />
                          </div>
                          <span className="tabular-nums text-muted-foreground w-6 text-right">{n}</span>
                        </div>
                      );
                    }) : <div className="text-sm text-muted-foreground">Sem sinais de cor ainda.</div>}
                  </div>
                  <div className="glass rounded-xl p-5 space-y-3">
                    <div className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="size-4 text-primary" /> Categorias dominantes</div>
                    {derived.categories.length ? derived.categories.slice(0, 8).map(([label, n]) => {
                      const max = derived.categories[0]?.[1] || 1;
                      return (
                        <div key={label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{label}</span><span>{n}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${(n / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    }) : <div className="text-sm text-muted-foreground">Sem categorias mapeadas.</div>}
                  </div>
                </TabsContent>

                <TabsContent value="mix" className="mt-0 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
                  <div className="glass rounded-xl p-5 space-y-3">
                    <div className="text-sm font-semibold">Distribuição do mix</div>
                    {(derived.categories.length ? derived.categories : [["Sem categoria", 0] as [string, number]]).map(([label, count]) => {
                      const max = Math.max(1, ...(derived.categories.length ? derived.categories.map((item) => item[1]) : [1]));
                      const numericCount = Number(count);
                      return (
                        <div key={label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{label}</span>
                            <span>{numericCount}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${(numericCount / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="glass rounded-xl p-5 space-y-3">
                    <div className="text-sm font-semibold">Produtos vinculados</div>
                    {selectedProducts.length ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {selectedProducts.map((product) => (
                          <div key={product.id} className="rounded-xl border border-border bg-background/30 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{product.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">{product.category || "Sem categoria"}</div>
                              </div>
                              <Badge variant="outline">{product.status}</Badge>
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground">Preço potencial {brl(Number(product.sell_price || 0))}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-10 text-center">Nenhum produto vinculado a esta coleção ainda.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="cronograma" className="mt-0 glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-5 text-sm font-semibold"><Clock3 className="size-4 text-primary" /> Cronograma macro</div>
                  <div className="space-y-4">
                    {timeline.map((step, index) => (
                      <div key={step.label} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">{index + 1}</div>
                          {index < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                        </div>
                        <div className="pb-5">
                          <div className="font-medium">{step.label}</div>
                          <div className="text-sm text-muted-foreground mt-1">{step.at.toLocaleDateString("pt-BR")}</div>
                          <div className="text-xs text-muted-foreground mt-2">Meta acumulada {step.progress}% do calendário.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="status" className="mt-0 glass rounded-xl p-5 space-y-3">
                  <div className="text-sm font-semibold">Status de produção por produto</div>
                  <div className="text-xs text-muted-foreground mb-2">Consolidação das OPs vinculadas aos produtos desta coleção.</div>
                  {selectedProducts.length ? (
                    <div className="space-y-2">
                      {selectedProducts.map((p) => {
                        const m = (productionByProduct as any)[p.id];
                        const pct = m && m.qty > 0 ? Math.min(100, Math.round((m.done / m.qty) * 100)) : 0;
                        const topStage = m ? Object.entries(m.stages).sort((a: any, b: any) => b[1] - a[1])[0] : null;
                        return (
                          <div key={p.id} className="rounded-lg border border-border bg-background/30 p-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{p.name}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                  <span>{m ? `${m.qty} pç` : "Sem OP"}</span>
                                  {topStage && <span>· etapa {String(topStage[0])}</span>}
                                  {m && m.late > 0 && <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">{m.late} atrasada(s)</Badge>}
                                </div>
                              </div>
                              <div className="w-32 shrink-0">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                                  <span>{pct}%</span>
                                  <span className="tabular-nums">{m?.done ?? 0}/{m?.qty ?? 0}</span>
                                </div>
                                <Progress value={pct} className="h-1.5" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-8 text-center">Nenhum produto vinculado.</div>
                  )}
                </TabsContent>

                <TabsContent value="performance" className="mt-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <PerformanceCard label="Produtos em desenvolvimento" value={String(derived.statusCount.desenvolvimento ?? 0)} />
                  <PerformanceCard label="Produtos aprovados" value={String(derived.statusCount.aprovado ?? 0)} />
                  <PerformanceCard label="Produtos em produção" value={String(derived.statusCount.producao ?? 0)} />
                  <PerformanceCard label="Cores mapeadas" value={String(derived.colors.length)} />
                </TabsContent>

                <TabsContent value="roi" className="mt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-5 space-y-4">
                    <div className="text-sm font-semibold flex items-center gap-2"><Target className="size-4 text-primary" /> Rentabilidade estimada</div>
                    <div className="grid grid-cols-2 gap-3">
                      <Metric label="Receita projetada" value={brl(derived.revenue)} />
                      <Metric label="Custo somado" value={brl(derived.cost)} />
                      <Metric label="Margem bruta" value={brl(derived.margin)} />
                      <Metric label="Margem %" value={`${derived.marginPct.toFixed(1)}%`} />
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5 space-y-4">
                    <div className="text-sm font-semibold">Leituras executivas</div>
                    {[
                      `A coleção concentra ${selectedProducts.length} SKUs em pipeline ativo.`,
                      derived.categories[0] ? `Categoria líder: ${derived.categories[0][0]} com ${derived.categories[0][1]} itens.` : "Ainda não há categorias consolidadas.",
                      derived.colors[0] ? `Cor mais recorrente: ${derived.colors[0][0]} em ${derived.colors[0][1]} produtos.` : "Ainda não há cores recorrentes suficientes.",
                    ].map((line) => (
                      <div key={line} className="rounded-lg border border-border bg-background/30 p-3 text-sm text-muted-foreground">{line}</div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => exportSpec(selected)} className="gap-2">
                  <Download className="size-4" /> Exportar spec
                </Button>
                {selected.owner_id === user?.id && (
                  <>
                    <Button variant="outline" onClick={() => duplicateMut.mutate(selected)} disabled={duplicateMut.isPending} className="gap-2">
                      <Copy className="size-4" /> Duplicar
                    </Button>
                    <Button variant="outline" onClick={() => openEdit(selected)} className="gap-2">
                      <Pencil className="size-4" /> Editar coleção
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => confirm("Remover esta coleção?") && deleteMut.mutate(selected.id)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" /> Remover
                    </Button>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <CollectionDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="text-lg font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function PerformanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function CollectionDialog({
  open,
  onOpenChange,
  editing,
  userId,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  editing: Collection | null;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [season, setSeason] = useState("Verão");
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [status, setStatus] = useState<Collection["status"]>("briefing");
  const [description, setDescription] = useState("");
  const [paletteStr, setPaletteStr] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setSeason(editing.season);
      setYear(editing.year);
      setStatus(editing.status);
      setDescription(editing.description || "");
      setPaletteStr(editing.palette.join(", "));
      setLaunchDate(editing.launch_date || "");
      setProgress(editing.progress);
      setCoverFile(null);
      return;
    }
    resetForm();
  }, [editing, open]);

  function resetForm() {
    setName("");
    setSeason("Verão");
    setYear(new Date().getFullYear() + 1);
    setStatus("briefing");
    setDescription("");
    setPaletteStr("");
    setLaunchDate("");
    setProgress(0);
    setCoverFile(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");

      let coverPath: string | null | undefined = undefined;
      if (coverFile) {
        if (coverFile.size > 5 * 1024 * 1024) throw new Error("Imagem deve ter no máximo 5MB");
        const extension = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("collection-covers").upload(path, coverFile, { contentType: coverFile.type });
        if (uploadError) throw uploadError;
        coverPath = path;
      }

      const payload = {
        name,
        season,
        year,
        status,
        description: description || null,
        palette: paletteStr.split(",").map((value) => value.trim()).filter(Boolean),
        launch_date: launchDate || null,
        progress,
        ...(coverPath !== undefined ? { cover_path: coverPath } : {}),
      };

      if (editing) {
        const { error } = await supabase.from("collections").update(payload).eq("id", editing.id);
        if (error) throw error;
        if (coverPath && editing.cover_path) {
          await supabase.storage.from("collection-covers").remove([editing.cover_path]);
        }
      } else {
        const { error } = await supabase.from("collections").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success(editing ? "Coleção atualizada" : "Coleção criada");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => {
      onOpenChange(value);
      if (!value) resetForm();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar coleção" : "Nova coleção"}</DialogTitle>
          <DialogDescription>Cadastre a coleção com narrativa, paleta, calendário e progresso executivo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => {
          event.preventDefault();
          saveMut.mutate();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Resort 2027" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Temporada</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Verão", "Inverno", "Resort", "Pré-Outono", "Pré-Verão", "Cápsula"].map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as Collection["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Conceito, storytelling e targets da coleção" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><ImagePlus className="size-4" /> Capa da coleção</Label>
            <Input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label>Paleta (cores separadas por vírgula)</Label>
            <Input value={paletteStr} onChange={(event) => setPaletteStr(event.target.value)} placeholder="#d6c3a1, #6f7f63, #f4ede2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de lançamento</Label>
              <Input type="date" value={launchDate} onChange={(event) => setLaunchDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Progresso ({progress}%)</Label>
              <Input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}