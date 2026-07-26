import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

type Shortcut = { keys: string[]; label: string; scope?: string };

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], label: "Abrir Command Palette", scope: "Global" },
  { keys: ["Ctrl", "K"], label: "Abrir Command Palette (Windows/Linux)", scope: "Global" },
  { keys: ["N"], label: "Criar novo produto (Quick Create)", scope: "Global" },
  { keys: ["P"], label: "Fixar/desafixar produto atual", scope: "Product Workspace" },
  { keys: ["?"], label: "Abrir esta ajuda de atalhos", scope: "Global" },
  { keys: ["Esc"], label: "Fechar diálogos abertos", scope: "Global" },
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" aria-hidden />
            Atalhos de teclado
          </DialogTitle>
          <DialogDescription>
            Trabalhe mais rápido sem tirar a mão do teclado.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{s.label}</span>
                {s.scope ? (
                  <span className="text-xs text-muted-foreground">{s.scope}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j} className="flex items-center gap-1">
                    <Key>{k}</Key>
                    {j < s.keys.length - 1 ? <span className="text-muted-foreground text-xs">+</span> : null}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
