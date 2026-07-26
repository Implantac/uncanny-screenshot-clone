import { lazy, Suspense, useEffect, useState } from "react";

// Lazy-load the heavy command palette (cmdk + dialog + queries) on first
// Cmd+K / Ctrl+K press. Saves ~parser + dep cost on every authenticated route.
const CommandPalette = lazy(() =>
  import("./command-palette").then((m) => ({ default: m.CommandPalette })),
);

export function CommandPaletteLazy() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        setShouldLoad(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!shouldLoad) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  );
}
