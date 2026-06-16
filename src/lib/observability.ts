// Lightweight structured logger for server functions / routes.
// Emits single-line JSON so Worker logs stay grep-friendly.

type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export async function withSpan<T>(
  event: string,
  fields: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log("info", event, { ...fields, ms: Date.now() - start, ok: true });
    return result;
  } catch (err) {
    log("error", event, {
      ...fields,
      ms: Date.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
