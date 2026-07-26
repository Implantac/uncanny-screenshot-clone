import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

// Wave 38 — "Go to..." navegação estilo Gmail/Linear.
// Sequência: pressione G e depois a tecla do destino em até 1.2s.
const TARGETS: Record<string, { path: string; label: string }> = {
  p: { path: "/produtos", label: "Produtos" },
  c: { path: "/colecoes", label: "Coleções" },
  k: { path: "/pcp-kanban", label: "Kanban do PCP" },
  a: { path: "/alertas", label: "Alertas" },
  d: { path: "/", label: "Início" },
  b: { path: "/biblioteca", label: "Biblioteca de materiais" },
  f: { path: "/ficha-tecnica", label: "Fichas técnicas" },
};

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
}

export function KeyboardQuickNav() {
  const navigate = useNavigate();
  const armedAt = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();

      // Armar sequência com "g"
      if (key === "g") {
        armedAt.current = Date.now();
        return;
      }

      if (armedAt.current && Date.now() - armedAt.current < 1200) {
        const target = TARGETS[key];
        armedAt.current = null;
        if (!target) return;
        e.preventDefault();
        navigate({ to: target.path });
        toast.success(`Indo para ${target.label}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return null;
}
