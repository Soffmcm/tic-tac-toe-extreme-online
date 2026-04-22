import { cn } from "@/lib/utils";

export const DEFAULT_SYMBOLS_X = ["❌", "🔥", "🌶️", "👑", "🦊", "⚡", "🍎", "🚀"] as const;
export const DEFAULT_SYMBOLS_O = ["⭕", "💧", "🌊", "🐳", "🍀", "🌟", "🫐", "🐢"] as const;

interface SymbolPickerProps {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<string>;
  /** Tailwind color class for the active ring, e.g. "ring-player-x". */
  ringClass?: string;
  label?: string;
}

/**
 * A compact picker that lets a player choose an emoji/character to use
 * instead of the default X or O glyph. Includes a free-text input for a
 * custom one-character or short string symbol.
 */
export function SymbolPicker({
  value,
  onChange,
  options,
  ringClass = "ring-primary",
  label,
}: SymbolPickerProps) {
  return (
    <div>
      {label && (
        <div className="text-[11px] font-bold uppercase tracking-wide text-foreground/60 mb-1.5">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center text-lg leading-none",
                "bg-background/70 border border-border transition-all",
                selected
                  ? `ring-2 ring-offset-1 ring-offset-background scale-110 ${ringClass}`
                  : "opacity-70 hover:opacity-100 hover:scale-105",
              )}
              aria-label={`Choose ${opt}`}
              aria-pressed={selected}
            >
              {opt}
            </button>
          );
        })}
        <input
          type="text"
          value={options.includes(value) ? "" : value}
          onChange={(e) => {
            // Limit to ~2 chars so emoji + variation selectors fit but not
            // arbitrary text. Strip whitespace.
            const v = e.target.value.replace(/\s/g, "").slice(0, 2);
            if (v.length > 0) onChange(v);
          }}
          placeholder="✏️"
          maxLength={2}
          className={cn(
            "h-9 w-12 rounded-xl border border-dashed border-border",
            "bg-background/70 text-center text-base font-bold",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background",
            ringClass === "ring-player-x" && "focus:ring-player-x",
            ringClass === "ring-player-o" && "focus:ring-player-o",
            ringClass === "ring-primary" && "focus:ring-primary",
          )}
          aria-label="Custom symbol"
        />
      </div>
    </div>
  );
}
