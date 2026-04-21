import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { GameState, MiniBoardResult, Player } from "@/lib/game-engine";
import { isLegalMove } from "@/lib/game-engine";
import { Mark } from "./Mark";

interface BoardProps {
  state: GameState;
  /** Player whose moves should be allowed from this client. Null = read-only. */
  playerSeat?: Player | null;
  /** Called when a legal move is clicked. */
  onMove?: (boardIndex: number, cellIndex: number) => void;
  /** Visually disable interactions (e.g., waiting for opponent). */
  disabled?: boolean;
}

function isBoardActive(state: GameState, boardIndex: number): boolean {
  if (state.winner !== null) return false;
  if (state.miniWinners[boardIndex] !== null) return false;
  if (state.activeBoard === null) return true;
  return state.activeBoard === boardIndex;
}

function MiniBoardOverlay({ result }: { result: MiniBoardResult }) {
  if (result === null) return null;
  if (result === "draw") {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-muted/85 backdrop-blur-[1px]"
      >
        <span className="font-display text-3xl font-bold text-muted-foreground">—</span>
      </motion.div>
    );
  }
  const bg = result === "X" ? "bg-player-x-soft" : "bg-player-o-soft";
  return (
    <motion.div
      initial={{ scale: 0, rotate: -15, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 16 }}
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-[1px]",
        bg,
      )}
    >
      <Mark player={result} size="xl" />
    </motion.div>
  );
}

export function Board({ state, playerSeat, onMove, disabled = false }: BoardProps) {
  const myTurn = playerSeat === undefined ? true : playerSeat === state.currentPlayer;
  const interactive = !disabled && state.winner === null && (playerSeat === undefined || myTurn);

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-1.5 sm:gap-2 rounded-3xl bg-board-line/90 p-1.5 sm:p-2 shadow-pop",
        "aspect-square w-full max-w-[min(92vw,640px)]",
      )}
    >
      {state.boards.map((cells, boardIndex) => {
        const result = state.miniWinners[boardIndex];
        const active = isBoardActive(state, boardIndex);
        const highlight = interactive && active;
        const ringColor =
          state.currentPlayer === "X" ? "ring-player-x" : "ring-player-o";

        return (
          <div
            key={boardIndex}
            className={cn(
              "relative grid grid-cols-3 gap-0.5 sm:gap-1 rounded-2xl bg-board p-1 sm:p-1.5 transition-all",
              highlight && cn("ring-4 sm:ring-[6px] ring-offset-0", ringColor, "shadow-soft"),
              !highlight && result === null && "opacity-95",
              !highlight && result === null && interactive && "opacity-60",
            )}
          >
            <AnimatePresence>
              {result !== null && <MiniBoardOverlay key="overlay" result={result} />}
            </AnimatePresence>

            {cells.map((cell, cellIndex) => {
              const legal =
                interactive && isLegalMove(state, boardIndex, cellIndex);
              return (
                <button
                  key={cellIndex}
                  type="button"
                  disabled={!legal}
                  onClick={() => legal && onMove?.(boardIndex, cellIndex)}
                  className={cn(
                    "group relative aspect-square rounded-md sm:rounded-lg bg-muted/60",
                    "flex items-center justify-center transition-all",
                    legal && "hover:bg-secondary/70 cursor-pointer active:scale-90",
                    !legal && "cursor-default",
                  )}
                  aria-label={`Mini-board ${boardIndex + 1}, cell ${cellIndex + 1}`}
                >
                  {cell ? (
                    <Mark player={cell} size="md" />
                  ) : (
                    legal && (
                      <span
                        className={cn(
                          "opacity-0 group-hover:opacity-30 transition-opacity",
                        )}
                      >
                        <Mark player={state.currentPlayer} size="md" animate={false} />
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
