// Wave 30 — Recentes: registro local de produtos vistos recentemente
const KEY = "plm.recent.products.v1";
const MAX = 8;

export type RecentProduct = { id: string; sku: string; name: string; at: number };

export function pushRecentProduct(p: Omit<RecentProduct, "at">) {
  if (typeof window === "undefined" || !p?.id) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentProduct[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x.id !== p.id);
    filtered.unshift({ ...p, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecentProducts(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentProduct[]) : [];
  } catch {
    return [];
  }
}
