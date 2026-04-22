import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/game-engine";

interface MarkProps {
  player: Player;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
  /** Optional custom symbol/emoji to render instead of the default X/O strokes. */
  symbol?: string | null;
}

const sizes = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-14 h-14",
  xl: "w-24 h-24 sm:w-32 sm:h-32",
};

const symbolTextSizes = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl sm:text-7xl",
};

const stroke = {
  sm: 4,
  md: 5,
  lg: 6,
  xl: 8,
};

export function Mark({ player, size = "md", className, animate = true, symbol }: MarkProps) {
  const color = player === "X" ? "var(--player-x)" : "var(--player-o)";
  const sw = stroke[size];

  // Custom symbol path: render the chosen character/emoji centered, tinted with the player color.
  if (symbol && symbol.trim().length > 0) {
    return (
      <motion.span
        role="img"
        aria-label={`${player}: ${symbol}`}
        className={cn(
          sizes[size],
          symbolTextSizes[size],
          "inline-flex items-center justify-center font-display font-bold leading-none select-none",
          className,
        )}
        style={{ color }}
        initial={animate ? { scale: 0, rotate: -20 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}
      >
        {symbol}
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
