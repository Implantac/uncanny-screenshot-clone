import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  FileText,
  Layers3,
  Pencil,
  Plus,
  Ruler,
  Scissors,
  Trash2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ficha-tecnica")({
  head: () => ({
    meta: [
      { title: "Ficha Técnica · USE MODA OS" },
      { name: "description", content: "Fichas técnicas com visualização de produto, seções estruturadas e histórico de versões." },
    ],
  }),
  component: FichaTecnicaPage,
});

type Status = "rascunho" | "em_revisao" | "aprovada";

type Sheet = {
  id: string;
  owner_id: string;
  product_id: string | null;
  code: string;
  version: string;
  status: Status;
  content: string | null;
  created_at: string;
};

type ProductRef = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  image_url: string | null;
};

type SheetContent = {
  overview: string;
  materials: string[];
  operations: string[];
  measurements: string[];
  consumption: string[];
  costs: string[];
  documents: string[];
};

const LABEL: Record<Status, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
};

const COLOR: Record<Status, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_revisao: "bg-warning/20 text-warning border-warning/30",
  aprovada: "bg-success/20 text-success border-success/30",
};

const EMPTY_CONTENT: SheetContent = {
  overview: "",
  materials: [],
  operations: [],
  measurements: [],
  consumption: [],
  costs: [],
  documents: [],
};

function parseSheetContent(content: string | null): SheetContent {
  if (!content) return EMPTY_CONTENT;
  try {
    const parsed = JSON.parse(content) as Partial<SheetContent>;
    return {
      overview: parsed.overview ?? "",
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      measurements: Array.isArray(parsed.measurements) ? parsed.measurements : [],
      consumption: Array.isArray(parsed.consumption) ? parsed.consumption : [],
      costs: Array.isArray(parsed.costs) ? parsed.costs : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch {
    return { ...EMPTY_CONTENT, overview: content };
  }
}

function stringifySheetContent(content: SheetContent) {
  return JSON.stringify(content);
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

async function resolveProductImage(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const { data, error } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

function FichaTecnicaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sheet | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["tech_sheets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tech_sheets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sheet[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["tech-sheet-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku, category, image_url").order("name");
      if (error) throw error;
      return data as ProductRef[];
    },
  });

  useEffect(() => {
    if (!sheets.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && sheets.some((sheet) => sheet.id === current) ? current : sheets[0].id));
  }, [sheets]);

  const selected = useMemo(() => sheets.find((item) => item.id === selectedId) ?? sheets[0] ?? null, [selectedId, sheets]);
  const selectedContent = useMemo(() => parseSheetContent(selected?.content ?? null), [selected?.content]);
  const selectedProduct = useMemo(() => products.find((product) => product.id === selected?.product_id) ?? null, [products, selected?.product_id]);

  const versionHistory = useMemo(() => {
    if (!selected) return [];
    return sheets.filter((item) => item.code === selected.code).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [selected, sheets]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_sheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success("Ficha removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(sheet: Sheet) {
    setEditing(sheet);
    setOpen(true);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Módulo 5</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Ficha Técnica Inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Visualização de produto, conteúdo estruturado por área e histórico versionado.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Nova ficha
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : sheets.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <ClipboardList className="size-10 text-primary mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Nenhuma ficha técnica cadastrada</h2>
          <p className="text-sm text-muted-foreground mb-4">Crie a primeira ficha para centralizar materiais, operações e custos.</p>
          <Button onClick={openCreate}>Criar ficha</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <section className="glass rounded-xl p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Biblioteca de versões</div>
              <div className="text-xs text-muted-foreground">{sheets.length} fichas ativas no workspace</div>
            </div>
            <div className="space-y-2">
              {sheets.map((sheet) => {
                const product = products.find((item) => item.id === sheet.product_id);
                const active = sheet.id === selected?.id;
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setSelectedId(sheet.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? "border-primary/40 bg-primary/10" : "border-border bg-background/30 hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{sheet.code}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{product?.name || "Sem produto vinculado"}</div>
                      </div>
                      <Badge variant="outline" className={COLOR[sheet.status]}>{LABEL[sheet.status]}</Badge>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">{sheet.version} · {new Date(sheet.created_at).toLocaleDateString("pt-BR")}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
                <ProductPreviewCard product={selectedProduct} code={selected.code} version={selected.version} status={selected.status} />

                <div className="glass rounded-xl p-5">
                  <Tabs defaultValue="materiais" className="space-y-4">
                    <TabsList className="w-full flex flex-wrap h-auto justify-start bg-transparent p-0 gap-2">
                      {[
                        ["materiais", "Materiais"],
                        ["operacoes", "Operações"],
                        ["medidas", "Medidas"],
                        ["consumo", "Consumo"],
                        ["custos", "Custos"],
                        ["documentos", "Documentos"],
                      ].map(([value, label]) => (
                        <TabsTrigger key={value} value={value} className="rounded-lg border border-border bg-background/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="materiais" className="mt-0">
                      <SectionList title="Materiais principais" icon={Layers3} items={selectedContent.materials} emptyLabel="Nenhum material detalhado." />
                    </TabsContent>
                    <TabsContent value="operacoes" className="mt-0">
                      <SectionList title="Fluxo operacional" icon={Scissors} items={selectedContent.operations} emptyLabel="Nenhuma operação cadastrada." />
                    </TabsContent>
                    <TabsContent value="medidas" className="mt-0">
                      <SectionList title="Medidas e grade" icon={Ruler} items={selectedContent.measurements} emptyLabel="Nenhuma medida informada." />
                    </TabsContent>
                    <TabsContent value="consumo" className="mt-0">
                      <SectionList title="Consumo" icon={ClipboardList} items={selectedContent.consumption} emptyLabel="Nenhum consumo informado." />
                    </TabsContent>
                    <TabsContent value="custos" className="mt-0">
                      <SectionList title="Custos" icon={Wallet} items={selectedContent.costs} emptyLabel="Nenhum custo informado." />
                    </TabsContent>
                    <TabsContent value="documentos" className="mt-0">
                      <SectionList title="Documentos e anexos" icon={FileText} items={selectedContent.documents} emptyLabel="Nenhum documento referenciado." chips />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-4">
                <div className="glass rounded-xl p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold">Observações gerais</div>
                    <div className="text-xs text-muted-foreground mt-1">Resumo central da engenharia de produto.</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/30 p-4 min-h-32 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                    {selectedContent.overview || "Sem observações gerais registradas."}
                  </div>
                </div>

                <div className="glass rounded-xl p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold">Histórico de versões</div>
                    <div className="text-xs text-muted-foreground mt-1">Auditoria rápida por código técnico.</div>
                  </div>
                  <div className="space-y-3">
                    {versionHistory.map((sheet) => (
                      <div key={sheet.id} className="rounded-xl border border-border bg-background/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{sheet.version}</div>
                          <Badge variant="outline" className={COLOR[sheet.status]}>{LABEL[sheet.status]}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">{new Date(sheet.created_at).toLocaleString("pt-BR")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selected.owner_id === user?.id && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => openEdit(selected)} className="gap-2">
                    <Pencil className="size-4" /> Editar ficha
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => del.mutate(selected.id)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" /> Remover
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <SheetDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} products={products} />
    </div>
  );
}

function ProductPreviewCard({
  product,
  code,
  version,
  status,
}: {
  product: ProductRef | null;
  code: string;
  version: string;
  status: Status;
}) {
  const { data: imageUrl } = useQuery({
    queryKey: ["tech-sheet-product-image", product?.image_url],
    queryFn: () => resolveProductImage(product?.image_url ?? null),
    enabled: Boolean(product?.image_url),
    staleTime: 50 * 60 * 1000,
  });

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="aspect-[4/4.8] bg-muted/20 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={product?.name || code} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="size-full grid place-items-center text-muted-foreground">
            <FileText className="size-10 text-primary/70" />
          </div>
        )}
      </div>
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={COLOR[status]}>{LABEL[status]}</Badge>
          <Badge variant="outline">{version}</Badge>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-1">Produto</div>
          <div className="text-xl font-semibold tracking-tight">{product?.name || "Produto não vinculado"}</div>
          <div className="text-sm text-muted-foreground mt-1">{product?.sku || code}{product?.category ? ` · ${product.category}` : ""}</div>
        </div>
      </div>
    </div>
  );
}

function SectionList({
  title,
  icon: Icon,
  items,
  emptyLabel,
  chips,
}: {
  title: string;
  icon: typeof FileText;
  items: string[];
  emptyLabel: string;
  chips?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold flex items-center gap-2"><Icon className="size-4 text-primary" /> {title}</div>
      {items.length ? (
        chips ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-xl border border-border bg-background/30 p-3 text-sm">{item}</div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{emptyLabel}</div>
      )}
    </div>
  );
}

function SheetDialog({
  open,
  onOpenChange,
  editing,
  userId,
  products,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  editing: Sheet | null;
  userId?: string;
  products: ProductRef[];
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [productId, setProductId] = useState("none");
  const [version, setVersion] = useState("v1.0");
  const [status, setStatus] = useState<Status>("rascunho");
  const [overview, setOverview] = useState("");
  const [materials, setMaterials] = useState("");
  const [operations, setOperations] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [consumption, setConsumption] = useState("");
  const [costs, setCosts] = useState("");
  const [documents, setDocuments] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const content = parseSheetContent(editing.content);
      setCode(editing.code);
      setProductId(editing.product_id ?? "none");
      setVersion(editing.version);
      setStatus(editing.status);
      setOverview(content.overview);
      setMaterials(content.materials.join("\n"));
      setOperations(content.operations.join("\n"));
      setMeasurements(content.measurements.join("\n"));
      setConsumption(content.consumption.join("\n"));
      setCosts(content.costs.join("\n"));
      setDocuments(content.documents.join("\n"));
      return;
    }
    reset();
  }, [editing, open]);

  function reset() {
    setCode("");
    setProductId("none");
    setVersion("v1.0");
    setStatus("rascunho");
    setOverview("");
    setMaterials("");
    setOperations("");
    setMeasurements("");
    setConsumption("");
    setCosts("");
    setDocuments("");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      if (!code.trim()) throw new Error("Código obrigatório");
      const payload = {
        owner_id: userId,
        code: code.trim(),
        product_id: productId === "none" ? null : productId,
        version: version.trim() || "v1.0",
        status,
        content: stringifySheetContent({
          overview: overview.trim(),
          materials: splitLines(materials),
          operations: splitLines(operations),
          measurements: splitLines(measurements),
          consumption: splitLines(consumption),
          costs: splitLines(costs),
          documents: splitLines(documents),
        }),
      };
      if (editing) {
        const { error } = await supabase.from("tech_sheets").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tech_sheets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success(editing ? "Ficha atualizada" : "Ficha criada");
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => {
      onOpenChange(value);
      if (!value) reset();
    }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ficha técnica" : "Nova ficha técnica"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Código</Label>
              <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="FT-001" required />
            </div>
            <div className="space-y-2">
              <Label>Versão</Label>
              <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="v1.0" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LABEL).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações gerais</Label>
            <Textarea rows={4} value={overview} onChange={(event) => setOverview(event.target.value)} placeholder="Resumo técnico, revisão, alertas de engenharia..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Materiais</Label><Textarea rows={5} value={materials} onChange={(event) => setMaterials(event.target.value)} placeholder="1 item por linha" /></div>
            <div className="space-y-2"><Label>Operações</Label><Textarea rows={5} value={operations} onChange={(event) => setOperations(event.target.value)} placeholder="1 item por linha" /></div>
            <div className="space-y-2"><Label>Medidas</Label><Textarea rows={5} value={measurements} onChange={(event) => setMeasurements(event.target.value)} placeholder="1 item por linha" /></div>
            <div className="space-y-2"><Label>Consumo</Label><Textarea rows={5} value={consumption} onChange={(event) => setConsumption(event.target.value)} placeholder="1 item por linha" /></div>
            <div className="space-y-2"><Label>Custos</Label><Textarea rows={5} value={costs} onChange={(event) => setCosts(event.target.value)} placeholder="1 item por linha" /></div>
            <div className="space-y-2"><Label>Documentos</Label><Textarea rows={5} value={documents} onChange={(event) => setDocuments(event.target.value)} placeholder="SVG, PDF, DXF, PLT..." /></div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar ficha"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}