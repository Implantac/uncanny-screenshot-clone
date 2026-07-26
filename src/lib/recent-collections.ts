// Wave 42 — Recentes: registro local de coleções visitadas
// Wave 43 — Pinned: curadoria manual de coleções favoritas
const KEY = "plm.recent.collections.v1";
const PIN_KEY = "plm.pinned.collections.v1";
const MAX = 6;
const MAX_PIN = 12;

export type RecentCollection = {
  id: string;
  name: string;
  season?: string | null;
  year?: number | null;
  at: number;
};

export type PinnedCollection = RecentCollection;

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

export function getPinnedCollections(): PinnedCollection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    return raw ? (JSON.parse(raw) as PinnedCollection[]) : [];
  } catch {
    return [];
  }
}

export function isCollectionPinned(id: string): boolean {
  return getPinnedCollections().some((c) => c.id === id);
}

export function togglePinnedCollection(c: Omit<PinnedCollection, "at">): boolean {
  if (typeof window === "undefined" || !c?.id) return false;
  try {
    const list = getPinnedCollections();
    const exists = list.some((x) => x.id === c.id);
    const next = exists
      ? list.filter((x) => x.id !== c.id)
      : [{ ...c, at: Date.now() }, ...list].slice(0, MAX_PIN);
    window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("plm:pinned-collections-changed"));
    return !exists;
  } catch {
    return false;
  }
}
