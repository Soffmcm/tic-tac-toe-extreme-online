import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/game-engine";
import type { PlayerSymbol } from "@/lib/symbols";

interface MarkProps {
  player: Player;
  /** Optional custom symbol (emoji/text). When provided, replaces the X/O SVG glyph. */
  symbol?: PlayerSymbol;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
}

const sizes = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-14 h-14",
  xl: "w-24 h-24 sm:w-32 sm:h-32",
};

/** Font sizes for the emoji/text variant — matches the SVG sizes above. */
const textSizes = {
  sm: "text-base leading-none",
  md: "text-2xl leading-none",
  lg: "text-4xl leading-none",
  xl: "text-7xl sm:text-8xl leading-none",
};

const stroke = {
  sm: 4,
  md: 5,
  lg: 6,
  xl: 8,
};

export function Mark({
  player,
  symbol,
  size = "md",
  className,
  animate = true,
}: MarkProps) {
  const color = player === "X" ? "var(--player-x)" : "var(--player-o)";
  const sw = stroke[size];

  // Custom symbol: render as text on a colored backdrop matching the seat.
  if (symbol) {
    return (
      <motion.span
        className={cn(
          sizes[size],
          "inline-flex items-center justify-center select-none",
          textSizes[size],
          className,
        )}
        initial={animate ? { scale: 0, rotate: -20 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}
        style={{ color }}
        aria-label={`${player} (${symbol})`}
      >
        <span aria-hidden>{symbol}</span>
      </motion.span>
    );
  }

  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={cn(sizes[size], className)}
      initial={animate ? { scale: 0, rotate: -20 } : false}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      aria-label={player}
    >
      {player === "X" ? (
        <>
          <motion.line
            x1="20" y1="20" x2="80" y2="80"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            initial={animate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25 }}
          />
          <motion.line
            x1="80" y1="20" x2="20" y2="80"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            initial={animate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25, delay: 0.08 }}
          />
        </>
      ) : (
        <motion.circle
          cx="50" cy="50" r="30"
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35 }}
        />
      )}
    </motion.svg>
  );
}
