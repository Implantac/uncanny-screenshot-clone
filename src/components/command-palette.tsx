import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { MODULES } from "@/lib/modules";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim();
  const { data } = useQuery({
    queryKey: ["palette", term],
    enabled: open && term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const [products, collections, suppliers] = await Promise.all([
        supabase.from("products").select("id, sku, name").or(`name.ilike.${like},sku.ilike.${like}`).limit(6),
        supabase.from("collections").select("id, name, season, year").ilike("name", like).limit(6),
        supabase.from("suppliers").select("id, name, category").ilike("name", like).limit(6),
      ]);
      return {
        products: products.data ?? [],
        collections: collections.data ?? [],
        suppliers: suppliers.data ?? [],
      };
    },
  });

  function go(path: string) {
    setOpen(false);
    setQ("");
    navigate({ to: path });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted/60 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex-1 min-w-0 max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate flex-1 text-left">Buscar…</span>
        <kbd className="hidden sm:block text-[10px] border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput value={q} onValueChange={setQ} placeholder="Buscar produtos, coleções, fornecedores, módulos…" />
        <CommandList>
          <CommandEmpty>{term.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum resultado"}</CommandEmpty>

          {!term && (
            <CommandGroup heading="Módulos">
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <CommandItem key={m.slug} onSelect={() => go(m.path)}>
                    <Icon className="size-4 mr-2" />
                    {m.title}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {data?.products.length ? (
            <CommandGroup heading="Produtos">
              {data.products.map((p) => (
                <CommandItem key={p.id} onSelect={() => go("/produtos")}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">{p.sku}</span>
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {data?.collections.length ? (
            <CommandGroup heading="Coleções">
              {data.collections.map((c) => (
                <CommandItem key={c.id} onSelect={() => go("/colecoes")}>
                  {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">{c.season} {c.year}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {data?.suppliers.length ? (
            <CommandGroup heading="Fornecedores">
              {data.suppliers.map((s) => (
                <CommandItem key={s.id} onSelect={() => go("/fornecedores")}>
                  {s.name}
                  <span className="ml-2 text-xs text-muted-foreground">{s.category}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
