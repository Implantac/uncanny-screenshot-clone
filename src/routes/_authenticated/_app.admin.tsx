import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoles } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import {
  adminDeleteCategory,
  adminDeleteProduct,
  adminListCategories,
  adminListProducts,
  adminListUsers,
  adminSaveCategory,
  adminSaveProduct,
  adminSetUserRole,
  adminUpdateUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/_app/admin")({
  head: () => ({
    meta: [
      { title: "Administração · USE MODA OS" },
      {
        name: "description",
        content: "Painel administrativo para gerenciar usuários, categorias e produtos.",
      },
      { property: "og:title", content: "Administração · USE MODA OS" },
      {
        property: "og:description",
        content: "Painel administrativo para gerenciar usuários, categorias e produtos.",
      },
    ],
  }),
  component: AdminPage,
});

const ROLES = ["admin", "gerente", "designer", "comprador", "vendedor"] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  designer: "Designer",
  comprador: "Comprador",
  vendedor: "Vendedor",
};
const PRODUCT_STATUS = [
  "rascunho",
  "desenvolvimento",
  "aprovado",
  "producao",
  "descontinuado",
] as const;

function AdminPage() {
  const { session } = useAuth();
  const { isAdmin, loading } = useRoles();

  if (loading) {
    return (
      <div className="p-8 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="glass rounded-2xl p-8 text-center">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-lg font-semibold mb-1">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            {session
              ? "Apenas administradores podem acessar o painel de administração."
              : "Entre na sua conta de administrador para acessar o painel."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Administração"
        title={
          <span className="inline-flex items-center gap-2">
            <Shield className="size-5 text-primary" /> Painel de administração
          </span>
        }
        description="Gerencie usuários, categorias e produtos diretamente, sem passar pelos fluxos operacionais."
      />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="produtos" className="mt-4">
          <ProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useToastHandlers(keys: string[]) {
  const qc = useQueryClient();
  return {
    onSuccess: () => {
      for (const k of keys) qc.invalidateQueries({ queryKey: [k] });
      toast.success("Alterações salvas");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao salvar alterações"),
  };
}

/* ---------------------------------- Usuários --------------------------------- */

function UsersTab() {
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);
  const updateUser = useServerFn(adminUpdateUser);
  const handlers = useToastHandlers(["admin-users", "user-roles", "team"]);
  const [editing, setEditing] = useState<{ id: string; fullName: string } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });

  const mRole = useMutation({
    mutationFn: (v: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
      setRole({ data: v }),
    ...handlers,
  });
  const mName = useMutation({
    mutationFn: (v: { userId: string; fullName: string }) => updateUser({ data: v }),
    ...handlers,
    onSuccess: () => {
      handlers.onSuccess();
      setEditing(null);
    },
  });

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3">Usuário</th>
            {ROLES.map((r) => (
              <th key={r} className="px-2 py-3 text-center">
                {ROLE_LABEL[r]}
              </th>
            ))}
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium">{u.fullName ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {u.email ?? `${u.id.slice(0, 8)}…`}
                </div>
              </td>
              {ROLES.map((r) => (
                <td key={r} className="px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary cursor-pointer"
                    checked={u.roles.includes(r)}
                    disabled={mRole.isPending}
                    onChange={(e) =>
                      mRole.mutate({ userId: u.id, role: r, enabled: e.target.checked })
                    }
                  />
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing({ id: u.id, fullName: u.fullName ?? "" })}
                >
                  <Pencil className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
          {!data?.length && (
            <tr>
              <td colSpan={ROLES.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                Nenhum usuário cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              value={editing?.fullName ?? ""}
              onChange={(e) => setEditing((p) => (p ? { ...p, fullName: e.target.value } : p))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editing?.fullName.trim() || mName.isPending}
              onClick={() =>
                editing && mName.mutate({ userId: editing.id, fullName: editing.fullName.trim() })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- Categorias -------------------------------- */

type CategoryForm = {
  id?: string;
  name: string;
  description: string;
  season: string;
  year: string;
};
const emptyCategory: CategoryForm = { name: "", description: "", season: "", year: "" };

function CategoriesTab() {
  const list = useServerFn(adminListCategories);
  const save = useServerFn(adminSaveCategory);
  const del = useServerFn(adminDeleteCategory);
  const handlers = useToastHandlers(["admin-categories"]);
  const [form, setForm] = useState<CategoryForm | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["admin-categories"], queryFn: () => list() });

  const mSave = useMutation({
    mutationFn: (v: CategoryForm) =>
      save({
        data: {
          ...(v.id ? { id: v.id } : {}),
          name: v.name.trim(),
          description: v.description.trim() || null,
          season: v.season.trim() || null,
          year: v.year ? Number(v.year) : null,
        },
      }),
    ...handlers,
    onSuccess: () => {
      handlers.onSuccess();
      setForm(null);
    },
  });
  const mDel = useMutation({ mutationFn: (id: string) => del({ data: { id } }), ...handlers });

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setForm({ ...emptyCategory })}>
          <Plus className="size-4 mr-1" /> Nova categoria
        </Button>
      </div>
      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Descrição</th>
              <th className="text-left px-4 py-3">Estação</th>
              <th className="text-left px-4 py-3">Ano</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.description ?? "—"}</td>
                <td className="px-4 py-3">{c.season ?? "—"}</td>
                <td className="px-4 py-3">{c.year ?? "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        id: c.id,
                        name: c.name,
                        description: c.description ?? "",
                        season: c.season ?? "",
                        year: c.year ? String(c.year) : "",
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={mDel.isPending}
                    onClick={() => {
                      if (confirm(`Excluir a categoria "${c.name}"?`)) mDel.mutate(c.id);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={form?.name ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, name: e.target.value } : p))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Descrição</Label>
              <Textarea
                id="cat-desc"
                value={form?.description ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-season">Estação</Label>
                <Input
                  id="cat-season"
                  value={form?.season ?? ""}
                  onChange={(e) => setForm((p) => (p ? { ...p, season: e.target.value } : p))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-year">Ano</Label>
                <Input
                  id="cat-year"
                  type="number"
                  value={form?.year ?? ""}
                  onChange={(e) => setForm((p) => (p ? { ...p, year: e.target.value } : p))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!form?.name.trim() || mSave.isPending}
              onClick={() => form && mSave.mutate(form)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------- Produtos --------------------------------- */

type ProductForm = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  status: (typeof PRODUCT_STATUS)[number];
  costPrice: string;
  sellPrice: string;
  lineId: string;
};
const emptyProduct: ProductForm = {
  sku: "",
  name: "",
  category: "",
  status: "rascunho",
  costPrice: "",
  sellPrice: "",
  lineId: "",
};

function ProductsTab() {
  const list = useServerFn(adminListProducts);
  const listCats = useServerFn(adminListCategories);
  const save = useServerFn(adminSaveProduct);
  const del = useServerFn(adminDeleteProduct);
  const handlers = useToastHandlers(["admin-products", "products"]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProductForm | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: () => list({ data: { search: search.trim() || undefined } }),
  });
  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => listCats(),
  });

  const mSave = useMutation({
    mutationFn: (v: ProductForm) =>
      save({
        data: {
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku.trim(),
          name: v.name.trim(),
          category: v.category.trim() || null,
          status: v.status,
          costPrice: v.costPrice ? Number(v.costPrice) : null,
          sellPrice: v.sellPrice ? Number(v.sellPrice) : null,
          lineId: v.lineId || null,
        },
      }),
    ...handlers,
    onSuccess: () => {
      handlers.onSuccess();
      setForm(null);
    },
  });
  const mDel = useMutation({ mutationFn: (id: string) => del({ data: { id } }), ...handlers });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Buscar por nome ou SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" onClick={() => setForm({ ...emptyProduct })}>
          <Plus className="size-4 mr-1" /> Novo produto
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">SKU</th>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Custo</th>
                <th className="text-right px-4 py-3">Venda</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{p.cost_price ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{p.sell_price ?? "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          id: p.id,
                          sku: p.sku,
                          name: p.name,
                          category: p.category ?? "",
                          status: p.status as ProductForm["status"],
                          costPrice: p.cost_price != null ? String(p.cost_price) : "",
                          sellPrice: p.sell_price != null ? String(p.sell_price) : "",
                          lineId: p.line_id ?? "",
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={mDel.isPending}
                      onClick={() => {
                        if (confirm(`Excluir o produto "${p.name}"?`)) mDel.mutate(p.id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-sku">SKU</Label>
                <Input
                  id="p-sku"
                  value={form?.sku ?? ""}
                  onChange={(e) => setForm((p) => (p ? { ...p, sku: e.target.value } : p))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cat">Categoria (texto)</Label>
                <Input
                  id="p-cat"
                  value={form?.category ?? ""}
                  onChange={(e) => setForm((p) => (p ? { ...p, category: e.target.value } : p))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nome</Label>
              <Input
                id="p-name"
                value={form?.name ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, name: e.target.value } : p))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form?.status ?? "rascunho"}
                  onValueChange={(v) =>
                    setForm((p) => (p ? { ...p, status: v as ProductForm["status"] } : p))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Linha / categoria cadastrada</Label>
                <Select
                  value={form?.lineId || "none"}
                  onValueChange={(v) =>
                    setForm((p) => (p ? { ...p, lineId: v === "none" ? "" : v } : p))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem linha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem linha</SelectItem>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-cost">Custo</Label>
                <Input
                  id="p-cost"
                  type="number"
                  step="0.01"
                  value={form?.costPrice ?? ""}
                  onChange={(e) => setForm((p) => (p ? { ...p, costPrice: e.target.value } : p))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-sell">Preço de venda</Label>
                <Input
                  id="p-sell"
                  type="number"
                  step="0.01"
                  value={form?.sellPrice ?? ""}
                  onChange={(e) => setForm((p) => (p ? { ...p, sellPrice: e.target.value } : p))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!form?.sku.trim() || !form?.name.trim() || mSave.isPending}
              onClick={() => form && mSave.mutate(form)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
