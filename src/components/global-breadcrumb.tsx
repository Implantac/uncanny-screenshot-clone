import { Link, useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { MODULES } from "@/lib/modules";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

/**
 * Wave 27 — Global PLM Breadcrumbs.
 * Shows "Home › Group › Module" on every registered top-level module.
 * Hides itself on the root and on dynamic/detail routes so local
 * breadcrumbs (Product Workspace, Ficha, Prototype) keep priority.
 */
export function GlobalBreadcrumb() {
  const { location } = useRouterState();
  const path = location.pathname;

  if (path === "/") return null;
  const mod = MODULES.find((m) => m.path === path);
  if (!mod) return null; // dynamic route — let the page render its own trail

  return (
    <div className="px-4 md:px-6 pt-3 pb-1">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-1 hover:text-foreground">
                <Home className="size-3" aria-hidden="true" />
                <span className="sr-only">Início</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {mod.group && (
            <Fragment>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="text-muted-foreground">{mod.group}</span>
              </BreadcrumbItem>
            </Fragment>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="truncate max-w-[320px]">{mod.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
