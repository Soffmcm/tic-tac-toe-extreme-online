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
        className="absolute inset-0 z-10 flex items-center justify-center bg-muted/85 backdrop-blur-[1px]"
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
        "absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]",
        bg,
      )}
    >
      <Mark player={result} size="xl" />
    </motion.div>
  );
}

/**
 * Classical Ultimate Tic-Tac-Toe board.
 * - One outer square holding a 3×3 meta-grid drawn with THICK lines.
 * - Each mini-board is a 3×3 of cells with THINNER lines.
 * - Lines are achieved with borders so the look is clean and classical,
 *   not a stack of tinted tiles.
 */
export function Board({ state, playerSeat, onMove, disabled = false }: BoardProps) {
  const myTurn = playerSeat === undefined ? true : playerSeat === state.currentPlayer;
  const interactive = !disabled && state.winner === null && (playerSeat === undefined || myTurn);

  return (
    <div
      className={cn(
        "relative grid grid-cols-3 grid-rows-3 bg-board rounded-xl overflow-hidden",
        "aspect-square w-full max-w-[min(92vw,640px)]",
        // Outer frame — thick, classical
        "border-[3px] sm:border-4 border-board-line shadow-pop",
      )}
    >
      {state.boards.map((cells, boardIndex) => {
        const result = state.miniWinners[boardIndex];
        const active = isBoardActive(state, boardIndex);
        const highlight = interactive && active;

        const col = boardIndex % 3;
        const row = Math.floor(boardIndex / 3);

        // Thick meta-grid lines drawn as borders between mini-boards.
        const metaBorders = cn(
          col > 0 && "border-l-[3px] sm:border-l-4 border-l-board-line",
          row > 0 && "border-t-[3px] sm:border-t-4 border-t-board-line",
        );

        return (
          <div
            key={boardIndex}
            className={cn(
              "relative grid grid-cols-3 grid-rows-3 bg-board transition-colors",
              metaBorders,
              highlight && "bg-secondary/25",
              !highlight && result === null && interactive && "bg-board",
            )}
          >
            <AnimatePresence>
              {result !== null && <MiniBoardOverlay key="overlay" result={result} />}
            </AnimatePresence>

            {cells.map((cell, cellIndex) => {
              const legal =
                interactive && isLegalMove(state, boardIndex, cellIndex);

              const cCol = cellIndex % 3;
              const cRow = Math.floor(cellIndex / 3);

              // Thin mini-grid lines between cells within the mini-board.
              const cellBorders = cn(
                cCol > 0 && "border-l border-l-board-line/40",
                cRow > 0 && "border-t border-t-board-line/40",
              );

              return (
                <button
                  key={cellIndex}
                  type="button"
                  disabled={!legal}
                  onClick={() => legal && onMove?.(boardIndex, cellIndex)}
                  className={cn(
                    "group relative aspect-square",
                    "flex items-center justify-center transition-colors",
                    cellBorders,
                    legal && "hover:bg-secondary/40 cursor-pointer active:scale-95",
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
                          "opacity-0 group-hover:opacity-25 transition-opacity",
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
