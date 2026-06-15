export function intelFilter<T extends Record<string, any>>(
  items: T[],
  q: string,
  fields: string[],
  lookup?: any[],
): T[] {
  const term = q.trim().toLowerCase();
  if (!term) return items;
  const lookupMap = lookup ? new Map(lookup.map((x: any) => [x.id, x])) : null;
  return items.filter((item) => {
    for (const f of fields) {
      const v = item?.[f];
      if (typeof v === "string" && v.toLowerCase().includes(term)) return true;
    }
    if (lookupMap && "product_id" in item) {
      const ref: any = lookupMap.get((item as any).product_id);
      if (ref && typeof ref.name === "string" && ref.name.toLowerCase().includes(term)) return true;
      if (ref && typeof ref.sku === "string" && ref.sku.toLowerCase().includes(term)) return true;
    }
    return false;
  });
}
