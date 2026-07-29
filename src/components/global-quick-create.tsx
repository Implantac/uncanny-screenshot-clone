import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProductQuickCreateDialog } from "@/components/product-quick-create-dialog-lazy";
import { ProductCreationWizard } from "@/components/product-creation-wizard";
import { FAB_EVENT } from "@/components/contextual-fab";

/**
 * Wave 28 — Atalho global "N" para criar uma peça de qualquer tela.
 * - Em rotas com FAB dedicado (/produtos, /colecoes, ...), dispara o evento
 *   FAB_EVENT para que a página abra seu próprio Dialog.
 * - Nas demais rotas, abre diretamente o ProductQuickCreateDialog.
 * - Ignora quando o foco está em input/textarea/contentEditable.
 */
const FAB_ROUTES = new Set([
  "/produtos",
  "/colecoes",
  "/prototipos",
  "/ficha-tecnica",
  "/materiais",
]);

export function GlobalQuickCreate() {
  const { user } = useAuth();
  const { location } = useRouterState();
  const [openQuick, setOpenQuick] = useState(false);
  const [openWizard, setOpenWizard] = useState(false);
  const [useWizard, setUseWizard] = useState(false);

  const { data: collections = [] } = useQuery({
    queryKey: ["collections-ref"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, season, year")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // Se a rota atual tem um FAB dedicado, delega ao evento existente.
      if (FAB_ROUTES.has(location.pathname)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(FAB_EVENT));
        return;
      }
      e.preventDefault();

      // Check if user has any products yet — if not, use wizard
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user?.id ?? "")
        .limit(1)
        .then(({ count }) => {
          if (count === 0) {
            setUseWizard(true);
            setOpenWizard(true);
          } else {
            setUseWizard(false);
            setOpenQuick(true);
          }
        }, () => {
          // Fallback: quick dialog on error
          setOpenQuick(true);
        });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname, user?.id]);

  if (!user) return null;

  return (
    <>
      <ProductQuickCreateDialog
        open={openQuick}
        onOpenChange={setOpenQuick}
        userId={user.id}
        collections={collections}
      />
      <ProductCreationWizard
        open={openWizard}
        onOpenChange={(v) => {
          setOpenWizard(v);
          if (!v) setUseWizard(false);
        }}
      />
    </>
  );
}
