import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Flag, ArrowLeft, Copy, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Board } from "./Board";
import { Mark } from "./Mark";
import {
  countMiniBoardWins,
  type GameState,
  type Player,
} from "@/lib/game-engine";
import { fireConfetti } from "@/lib/confetti";
import { sfx } from "@/lib/sounds";

interface PlayerInfo {
  name: string;
  player: Player;
  /** Optional custom symbol/emoji to render in place of X or O. */
  symbol?: string | null;
}

interface GameViewProps {
  state: GameState;
  playerX: PlayerInfo;
  playerO: PlayerInfo;
  /** Player seat for the local viewer. undefined = same device for both (local play). */
  mySeat?: Player | null;
  onMove: (boardIndex: number, cellIndex: number) => void;
  onNewGame?: () => void;
  onResign?: () => void;
  /** Optional invite-link controls shown when waiting for an opponent. */
  inviteUrl?: string | null;
  waitingForOpponent?: boolean;
  /** Banner string for online status (e.g., "Opponent disconnected"). */
  statusBanner?: string | null;
}

export function GameView({
  state,
  playerX,
  playerO,
  mySeat,
  onMove,
  onNewGame,
  onResign,
  inviteUrl,
  waitingForOpponent,
  statusBanner,
}: GameViewProps) {
  const scores = countMiniBoardWins(state);
  const [copied, setCopied] = useState(false);
  const lastHistoryLen = useRef(state.history.length);
  const lastMiniWins = useRef(state.miniWinners.filter((r) => r === "X" || r === "O").length);
  const winnerFiredRef = useRef<typeof state.winner>(null);

  // Sounds: pop on each new move; chime on each new mini-win; fanfare + confetti on game win.
  useEffect(() => {
    if (state.history.length > lastHistoryLen.current) {
      sfx.pop();
      lastHistoryLen.current = state.history.length;
    }
    const miniWins = state.miniWinners.filter((r) => r === "X" || r === "O").length;
    if (miniWins > lastMiniWins.current) {
      sfx.miniWin();
      lastMiniWins.current = miniWins;
    }
    if (state.winner && state.winner !== winnerFiredRef.current) {
      winnerFiredRef.current = state.winner;
      if (state.winner !== "draw") {
        sfx.gameWin();
        fireConfetti();
      }
    }
    if (!state.winner) winnerFiredRef.current = null;
  }, [state.history.length, state.miniWinners, state.winner]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const turnPlayer = state.currentPlayer;
  const turnInfo = turnPlayer === "X" ? playerX : playerO;
  const symbols = { X: playerX.symbol ?? null, O: playerO.symbol ?? null };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/" aria-label="Home">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="flex-1 grid grid-cols-2 gap-2 max-w-md">
            <ScoreCard
              info={playerX}
              score={scores.X}
              isTurn={turnPlayer === "X" && !state.winner}
              isMe={mySeat === "X"}
              symbol={symbols.X}
            />
            <ScoreCard
              info={playerO}
              score={scores.O}
              isTurn={turnPlayer === "O" && !state.winner}
              isMe={mySeat === "O"}
              symbol={symbols.O}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start py-4 px-2 sm:px-4">
        {/* Status / turn banner */}
        <div className="h-10 flex items-center justify-center mb-2">
          {statusBanner ? (
            <span className="text-sm font-semibold text-destructive bg-destructive/10 px-3 py-1.5 rounded-full">
              {statusBanner}
            </span>
          ) : state.winner ? null : waitingForOpponent ? (
            <span className="text-sm font-semibold text-muted-foreground">
              Waiting for opponent…
            </span>
          ) : (
            <motion.div
              key={`${turnPlayer}-${state.history.length}`}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-2 text-sm sm:text-base font-bold"
            >
              <Mark player={turnPlayer} size="sm" animate={false} symbol={symbols[turnPlayer]} />
              <span>
                {mySeat && mySeat === turnPlayer ? (
                  <span className="text-primary">Your turn</span>
                ) : (
                  <>
                    <span className={turnPlayer === "X" ? "text-player-x" : "text-player-o"}>
                      {turnInfo.name}
                    </span>
                    <span className="text-muted-foreground">'s turn</span>
                  </>
                )}
              </span>
              {state.activeBoard === null && state.history.length > 0 && (
                <span className="text-xs text-muted-foreground">· free choice!</span>
              )}
            </motion.div>
          )}
        </div>

        <Board
          state={state}
          playerSeat={mySeat ?? undefined}
          onMove={onMove}
          disabled={!!waitingForOpponent}
          symbols={symbols}
        />

        {/* Bottom controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {inviteUrl && waitingForOpponent && (
            <Button
              onClick={copyInvite}
              variant="default"
              className="rounded-2xl font-bold"
            >
              {copied ? <Check className="!size-4" /> : <Copy className="!size-4" />}
              {copied ? "Copied!" : "Copy invite link"}
            </Button>
          )}
          {onNewGame && (
            <Button
              onClick={onNewGame}
              variant="secondary"
              className="rounded-2xl font-bold"
            >
              <RotateCcw className="!size-4" />
              New game
            </Button>
          )}
          {onResign && !state.winner && !waitingForOpponent && (
            <Button
              onClick={onResign}
              variant="ghost"
              className="rounded-2xl font-bold text-muted-foreground"
            >
              <Flag className="!size-4" />
              Resign
            </Button>
          )}
        </div>
      </main>

      {/* Win overlay */}
      <AnimatePresence>
        {state.winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 20 }}
              className="bg-card border-4 border-primary rounded-3xl p-8 sm:p-10 max-w-md w-full text-center shadow-pop"
            >
              {state.winner === "draw" ? (
                <>
                  <div className="text-6xl mb-3">🤝</div>
                  <h2 className="font-display text-3xl font-bold mb-2">It's a draw!</h2>
                  <p className="text-muted-foreground mb-6">A truly worthy battle.</p>
                </>
              ) : (
                <>
                  <div className="flex justify-center mb-3">
                    <Mark
                      player={state.winner}
                      size="xl"
                      symbol={state.winner === "X" ? symbols.X : symbols.O}
                    />
                  </div>
                  <h2 className="font-display text-3xl font-bold mb-2">
                    {(state.winner === "X" ? playerX.name : playerO.name)} wins!
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {mySeat === state.winner
                      ? "Beautifully played!"
                      : "GG. Run it back?"}
                  </p>
                </>
              )}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {onNewGame && (
                  <Button
                    onClick={onNewGame}
                    size="lg"
                    className="rounded-2xl font-bold"
                  >
                    Play again
                  </Button>
                )}
                <Button asChild size="lg" variant="secondary" className="rounded-2xl font-bold">
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreCard({
  info,
  score,
  isTurn,
  isMe,
}: {
  info: PlayerInfo;
  score: number;
  isTurn: boolean;
  isMe?: boolean;
}) {
  const isX = info.player === "X";
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 transition-all ${
        isX ? "bg-player-x-soft" : "bg-player-o-soft"
      } ${isTurn ? "ring-2 ring-offset-1 ring-offset-background scale-[1.02] " + (isX ? "ring-player-x" : "ring-player-o") : "opacity-80"}`}
    >
      <Mark player={info.player} size="sm" animate={false} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide font-bold text-foreground/60 leading-none">
          {isMe ? "You" : "Player"}
        </div>
        <div className="text-sm font-bold truncate">{info.name}</div>
      </div>
      <div className={`font-display font-bold text-xl ${isX ? "text-player-x" : "text-player-o"}`}>
        {score}
      </div>
    </div>
  );
}
