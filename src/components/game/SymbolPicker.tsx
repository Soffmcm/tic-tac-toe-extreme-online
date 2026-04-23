import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mark } from "./Mark";
import {
  POPULAR_EMOJI,
  sanitizeSymbol,
  type PlayerSymbol,
} from "@/lib/symbols";
import type { Player } from "@/lib/game-engine";

interface SymbolPickerProps {
  /** Which seat this picker is for — controls the default X/O preview. */
  seat: Player;
  /** Current value. null means "use the default X/O mark". */
  value: PlayerSymbol;
  onChange: (next: PlayerSymbol) => void;
  /** Optional label shown above the picker (e.g. "Player X symbol"). */
  label?: string;
  /** Compact = smaller grid, used inside lobby cards. */
  compact?: boolean;
}

/**
 * Symbol picker — lets the user pick from popular emoji or type their own.
 * Selecting "Default" resets to the classic X / O mark.
 */
export function SymbolPicker({
  seat,
  value,
  onChange,
  label,
  compact = false,
}: SymbolPickerProps) {
  const [custom, setCustom] = useState("");

  const isDefault = value === null;
  const seatBg = seat === "X" ? "bg-player-x-soft" : "bg-player-o-soft";
  const seatRing = seat === "X" ? "ring-player-x" : "ring-player-o";

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-bold uppercase text-foreground/60">
          {label}
        </div>
      )}

      {/* Live preview */}
      <div className={cn("flex items-center gap-3 rounded-2xl p-3", seatBg)}>
        <div className="flex size-12 items-center justify-center">
          <Mark player={seat} symbol={value} size="lg" animate={false} />
        </div>
        <div className="text-sm font-semibold">
          {isDefault ? `Classic ${seat}` : "Custom symbol"}
          <div className="text-xs font-normal text-foreground/60">
            Wins still get the {seat === "X" ? "red" : "blue"} background.
          </div>
        </div>
      </div>

      {/* Default + emoji grid */}
      <div
        className={cn(
          "grid gap-1.5",
          compact ? "grid-cols-8" : "grid-cols-8 sm:grid-cols-10",
        )}
      >
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold uppercase",
            "bg-muted hover:bg-muted/70 transition-colors",
            isDefault && `ring-2 ring-offset-1 ring-offset-background ${seatRing}`,
          )}
          aria-label="Use default symbol"
          title="Default"
        >
          <Mark player={seat} size="sm" animate={false} />
        </button>

        {POPULAR_EMOJI.map((emoji) => {
          const selected = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-xl",
                "bg-muted/60 hover:bg-muted transition-colors",
                selected &&
                  `ring-2 ring-offset-1 ring-offset-background ${seatRing}`,
              )}
              aria-label={`Use ${emoji}`}
              title={emoji}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or type any emoji / character…"
          maxLength={8}
          className="rounded-xl text-base"
        />
        <Button
          type="button"
          variant="secondary"
          className="rounded-xl font-bold"
          disabled={!sanitizeSymbol(custom)}
          onClick={() => {
            const s = sanitizeSymbol(custom);
            if (s) {
              onChange(s);
              setCustom("");
            }
          }}
        >
          Use
        </Button>
      </div>
    </div>
  );
}
