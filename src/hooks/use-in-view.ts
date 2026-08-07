import { useEffect, useRef, useState } from "react";

/**
 * `useInView` — observa se um elemento entrou na viewport.
 * Usado para lazy loading: só monta/consulta conteúdo pesado quando o
 * usuário realmente rola até ele (reduz trabalho na carga inicial).
 *
 * Retorna um ref para anexar ao elemento e um boolean `inView`.
 * `once` garante que, após entrar, permaneça montado (não desmonta ao sair).
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options?: {
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = "0px 0px 200px 0px", threshold = 0.01, once = true } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: se a API não existir, monta direto.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        });
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
