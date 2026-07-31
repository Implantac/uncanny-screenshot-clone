import { useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { PlmBreadcrumb, type PlmBreadcrumbItem } from "@/components/ui/plm-breadcrumb";

/**
 * Wave 27 — Global PLM Breadcrumbs.
 * Shows "Home › Group › Module" on every registered top-level module.
 * Hides itself on the root and on dynamic/detail routes so local
 * breadcrumbs (Product Workspace, Ficha, Prototype) keep priority.
 * Uses PlmBreadcrumb for consistent icon resolution and styling.
 */
export function GlobalBreadcrumb() {
  const { location } = useRouterState();
  const path = location.pathname;

  if (path === "/") return null;
  const mod = MODULES.find((m) => m.path === path);
  if (!mod) return null; // dynamic route — let the page render its own trail

  const items: PlmBreadcrumbItem[] = [
    { label: "Início", link: { to: "/" }, icon: Home },
  ];

  if (mod.group) {
    items.push({ label: mod.group });
  }

  items.push({ label: mod.title, icon: mod.icon });

  return (
    <div className="px-4 md:px-6 pt-3 pb-1">
      <PlmBreadcrumb items={items} />
    </div>
  );
}
