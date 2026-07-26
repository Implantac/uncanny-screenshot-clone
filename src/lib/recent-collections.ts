// Wave 42 — Recentes: registro local de coleções visitadas
const KEY = "plm.recent.collections.v1";
const MAX = 6;

export type RecentCollection = {
  id: string;
  name: string;
  season?: string | null;
  year?: number | null;
  at: number;
};

export function pushRecentCollection(c: Omit<RecentCollection, "at">) {
  if (typeof window === "undefined" || !c?.id) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentCollection[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x.id !== c.id);
    filtered.unshift({ ...c, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecentCollections(): RecentCollection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentCollection[]) : [];
  } catch {
    return [];
  }
}
