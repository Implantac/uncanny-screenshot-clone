type LookupItem = {
  id: unknown;
  name?: unknown;
  sku?: unknown;
};

export function intelFilter<T extends Record<string, unknown>>(
  items: T[],
  q: string,
  fields: string[],
  lookup?: LookupItem[],
): T[] {
  const term = q.trim().toLowerCase();
  if (!term) return items;
  const lookupMap = lookup ? new Map(lookup.map((x) => [x.id, x])) : null;
  return items.filter((item) => {
    for (const f of fields) {
      const v = item?.[f];
      if (typeof v === "string" && v.toLowerCase().includes(term)) return true;
    }
    if (lookupMap && "product_id" in item) {
      const ref = lookupMap.get(item.product_id);
      if (ref && typeof ref.name === "string" && ref.name.toLowerCase().includes(term)) return true;
      if (ref && typeof ref.sku === "string" && ref.sku.toLowerCase().includes(term)) return true;
    }
    return false;
  });
}
