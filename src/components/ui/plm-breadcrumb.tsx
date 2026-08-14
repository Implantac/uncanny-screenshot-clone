import { Link, type LinkProps } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MODULES, type ModuleDef } from "@/lib/modules";
import {
  Home,
  Layers,
  Sparkles,
  FileText,
  Scissors,
  Factory,
  Package,
  Ruler,
  Wallet,
  BarChart3,
  Clock,
  type LucideIcon,
} from "lucide-react";

/**
 * Map common module paths to icons for contextual breadcrumbs.
 */
const MODULE_ICON: Record<string, LucideIcon> = {};
for (const m of MODULES) {
  MODULE_ICON[m.path] = m.icon;
  MODULE_ICON[m.slug] = m.icon;
}

/** Fallback icons by keyword in label or path */
const FALLBACK_ICONS: Record<string, LucideIcon> = {
  inicio: Home,
  home: Home,
  coleção: Layers,
  colecoes: Layers,
  produto: Sparkles,
  produtos: Sparkles,
  "ficha técnica": FileText,
  "ficha-tecnica": FileText,
  protótipo: Scissors,
  prototipos: Scissors,
  produção: Factory,
  producao: Factory,
  custo: Wallet,
  custos: Wallet,
  medida: Ruler,
  medidas: Ruler,
  grade: Ruler,
  bi: BarChart3,
  timeline: Clock,
  lote: Package,
  lotes: Package,
  kanban: Factory,
};

function resolveIcon(item: PlmBreadcrumbItem): LucideIcon {
  // Try by link.to
  if (item.link?.to) {
    const icon = MODULE_ICON[item.link.to];
    if (icon) return icon;
  }
  // Try by label string
  const labelStr = typeof item.label === "string" ? item.label.toLowerCase() : "";
  for (const [keyword, icon] of Object.entries(FALLBACK_ICONS)) {
    if (labelStr.includes(keyword)) return icon;
  }
  return Home;
}

export type PlmBreadcrumbItem = {
  label: ReactNode;
  /** Ícone contextual. Se omitido, tenta resolver automaticamente. */
  icon?: LucideIcon;
  /** Any TanStack Router link (to/params/search). Omit for current page. */
  link?: Pick<LinkProps, "to" | "params" | "search">;
};

/**
 * Consistent breadcrumb for PLM screens with contextual icons.
 * Renders `Coleção > Produto > SKU` style trails without ceremony.
 * The last item is always rendered as the current page with a highlighted icon.
 */
export function PlmBreadcrumb({
  items,
  className,
}: {
  items: PlmBreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="text-xs">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const Icon = item.icon ?? resolveIcon(item);
          return (
            <Fragment key={i}>
              <BreadcrumbItem>
                {isLast || !item.link ? (
                  <BreadcrumbPage className="truncate max-w-[280px] flex items-center gap-1.5">
                    <Icon
                      className={`size-3.5 ${isLast ? "text-primary" : "text-muted-foreground"}`}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Link
                      {...(item.link as any)}
                      className="hover:text-foreground truncate max-w-[200px] flex items-center gap-1.5"
                    >
                      <Icon
                        className="size-3.5 text-muted-foreground group-hover:text-foreground"
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
