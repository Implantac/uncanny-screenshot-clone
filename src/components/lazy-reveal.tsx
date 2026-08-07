import type { ReactNode } from "react";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

/**
 * `LazyReveal` — só monta o filho quando o usuário rola até ele.
 * Reduz trabalho (queries/render) na carga inicial da página.
 * Enquanto não visível, renderiza um placeholder de altura indicada.
 */
export function LazyReveal({
  children,
  minHeight = 320,
  className,
  placeholderClass = "bg-muted/20 rounded-xl animate-pulse",
}: {
  children: ReactNode;
  minHeight?: number;
  className?: string;
  placeholderClass?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className={cn("relative", className)}>
      {inView ? (
        children
      ) : (
        <div className={cn(placeholderClass)} style={{ minHeight }} aria-hidden />
      )}
    </div>
  );
}
