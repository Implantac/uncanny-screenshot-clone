import { Link, type LinkProps } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type PlmBreadcrumbItem = {
  label: React.ReactNode;
  /** Any TanStack Router link (to/params/search). Omit for current page. */
  link?: Pick<LinkProps, "to" | "params" | "search">;
};

/**
 * Consistent breadcrumb for PLM screens.
 * Renders `Coleção > Produto > SKU` style trails without ceremony.
 * The last item is always rendered as the current page.
 */
export function PlmBreadcrumb({ items, className }: { items: PlmBreadcrumbItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="text-xs">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={i}>
              <BreadcrumbItem>
                {isLast || !item.link ? (
                  <BreadcrumbPage className="truncate max-w-[280px]">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Link {...(item.link as any)} className="hover:text-foreground truncate max-w-[200px]">
                      {item.label}
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
