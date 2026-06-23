import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Compass, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/colecao-360")({
  head: () => ({
    meta: [
      { title: "Coleção 360º · USE MODA PLM" },
      {
        name: "description",
        content: "Visão única da coleção: protótipos, produtos, OPs, vendas e margem.",
      },
    ],
  }),
  component: Colecao360Redirect,
});

function Colecao360Redirect() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["colecao-360-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id")
        .order("year", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  useEffect(() => {
    if (data?.id) {
      navigate({
        to: "/colecao-360/$id",
        params: { id: data.id },
        replace: true,
      });
    }
  }, [data, navigate]);

  if (isLoading || data?.id) {
    return (
      <div className="p-8 grid place-items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        Abrindo a coleção mais recente…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center gap-3">
        <Compass className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coleção 360º</h1>
          <p className="text-sm text-muted-foreground">
            Visão única da coleção — protótipos, produtos, OPs, vendas e margem.
          </p>
        </div>
      </header>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma coleção cadastrada ainda.
        <Link to="/colecoes" className="ml-2 text-primary hover:underline">
          Criar coleção →
        </Link>
      </div>
    </div>
  );
}
