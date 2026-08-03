import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  colorSwatch?: boolean;
  className?: string;
};

/**
 * ChipInput — input de tags com uso visual (chips), substituindo o texto
 * livre separado por vírgula. Usuário digita/dá Enter ou clica em sugestões
 * para adicionar chips; remove com o X. Ideal para cores e tamanhos no PLM.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  colorSwatch = false,
  className,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const item = raw.trim();
    if (!item) return;
    if (value.includes(item)) {
      setDraft("");
      return;
    }
    onChange([...value, item]);
    setDraft("");
  };

  const remove = (item: string) => onChange(value.filter((x) => x !== item));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const remainingSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
    >
      {value.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary pl-2 pr-1 py-0.5 text-xs"
        >
          {colorSwatch && (
            <span
              className="size-3 rounded-full border border-border shrink-0"
              style={{ background: /^#[0-9a-f]{6}$/i.test(item) ? item : "transparent" }}
            />
          )}
          {item}
          <button
            type="button"
            aria-label={`Remover ${item}`}
            onClick={() => remove(item)}
            className="grid place-items-center size-4 rounded-full hover:bg-primary/15 text-primary/70"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="flex-1 min-w-[90px] bg-transparent outline-none placeholder:text-muted-foreground text-sm py-0.5"
      />
      {remainingSuggestions.length > 0 && (
        <div className="w-full flex flex-wrap gap-1 pt-1 border-t border-border/50 mt-0.5">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {colorSwatch && (
                <span
                  className="size-2.5 rounded-full border border-border shrink-0"
                  style={{ background: /^#[0-9a-f]{6}$/i.test(s) ? s : "transparent" }}
                />
              )}
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
