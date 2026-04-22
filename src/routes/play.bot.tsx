import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/game/Header";
import { Mark } from "@/components/game/Mark";
import { GameView } from "@/components/game/GameView";
import {
  SymbolPicker,
  DEFAULT_SYMBOLS_X,
  DEFAULT_SYMBOLS_O,
} from "@/components/game/SymbolPicker";
import { applyMove, createInitialState, type GameState, type Player } from "@/lib/game-engine";
import { chooseBotMove, type BotDifficulty } from "@/lib/bot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/bot")({
  head: () => ({
    meta: [
      { title: "Play vs Bot — Ultimate 3T" },
      {
        name: "description",
        content:
          "Play Ultimate Tic-Tac-Toe against a computer opponent. Choose easy, medium, hard, or extra hard.",
      },
      { property: "og:title", content: "Play vs Bot — Ultimate 3T" },
      {
        property: "og:description",
        content: "Solo Ultimate Tic-Tac-Toe against a four-level AI opponent.",
      },
    ],
  }),
  component: BotPlay,
});

const DIFFICULTIES: ReadonlyArray<{
  id: BotDifficulty;
  label: string;
  emoji: string;
  blurb: string;
  tone: string;
}> = [
  {
    id: "easy",
    label: "Easy",
    emoji: "🌱",
    blurb: "Plays random moves. Great for warming up.",
    tone: "bg-secondary/60",
  },
  {
    id: "medium",
    label: "Medium",
    emoji: "🎯",
    blurb: "Wins obvious lines and blocks the easy ones.",
    tone: "bg-player-o-soft",
  },
  {
    id: "hard",
    label: "Hard",
    emoji: "🔥",
    blurb: "Thinks one step ahead and won't gift you free turns.",
    tone: "bg-player-x-soft",
  },
  {
    id: "extra-hard",
    label: "Extra Hard",
    emoji: "💀",
    blurb: "Searches several moves ahead. Bring your A-game.",
    tone: "bg-foreground/85 text-background",
  },
];

function BotPlay() {
  const [started, setStarted] = useState(false);
  const [playerName, setPlayerName] = useState("You");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [humanSeat, setHumanSeat] = useState<Player>("X");
  const [humanSymbol, setHumanSymbol] = useState<string>(DEFAULT_SYMBOLS_X[0]);
  const [state, setState] = useState<GameState>(() => createInitialState());
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const botSeat: Player = humanSeat === "X" ? "O" : "X";
  const botName = `Bot · ${labelFor(difficulty)}`;
  const botSymbol = "🤖";

  // Symbol options + ring color follow the seat (X = red/coral, O = blue/teal).
  const humanSymbolOptions = humanSeat === "X" ? DEFAULT_SYMBOLS_X : DEFAULT_SYMBOLS_O;
  const humanRingClass = humanSeat === "X" ? "ring-player-x" : "ring-player-o";

  const playerX = humanSeat === "X"
    ? { name: playerName || "You", player: "X" as const, symbol: humanSymbol }
    : { name: botName, player: "X" as const, symbol: botSymbol };
  const playerO = humanSeat === "O"
    ? { name: playerName || "You", player: "O" as const, symbol: humanSymbol }
    : { name: botName, player: "O" as const, symbol: botSymbol };

  // Bot move loop: whenever it's the bot's turn and game isn't over, schedule a move.
  useEffect(() => {
    if (!started) return;
    if (state.winner !== null) return;
    if (state.currentPlayer !== botSeat) return;

    // Small artificial delay so moves feel deliberate, scaled by difficulty.
    const baseDelay =
      difficulty === "easy" ? 350
      : difficulty === "medium" ? 500
      : difficulty === "hard" ? 700
      : 900;
    const jitter = Math.random() * 250;

    botTimer.current = setTimeout(() => {
      const move = chooseBotMove(state, difficulty);
      if (move) {
        const next = applyMove(state, move.boardIndex, move.cellIndex);
        if (next) setState(next);
      }
    }, baseDelay + jitter);

    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
  }, [started, state, botSeat, difficulty]);

  const handleMove = (b: number, c: number) => {
    if (state.currentPlayer !== humanSeat) return;
    const next = applyMove(state, b, c);
    if (next) setState(next);
  };

  const reset = () => {
    if (botTimer.current) clearTimeout(botTimer.current);
    setState(createInitialState());
  };

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg bg-card rounded-3xl shadow-pop border border-border p-6 sm:p-8">
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
              <Link to="/">
                <ArrowLeft className="!size-4" /> Back
              </Link>
            </Button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <Bot className="size-5 text-primary" />
                <span className="font-display font-bold uppercase text-xs tracking-widest text-muted-foreground">
                  Play vs Bot
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold">Pick your challenger</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Solo practice against a four-level AI.
              </p>
            </div>

            {/* Name */}
            <div className="rounded-2xl bg-muted/50 p-4 flex items-center gap-3 mb-5">
              <Mark player={humanSeat} size="md" animate={false} />
              <div className="flex-1">
                <Label htmlFor="botPlayerName" className="text-xs font-bold uppercase text-foreground/60">
                  Your name
                </Label>
                <Input
                  id="botPlayerName"
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="border-0 bg-transparent shadow-none px-0 text-base font-bold focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Seat picker */}
            <div className="mb-5">
              <div className="text-xs font-bold uppercase text-foreground/60 mb-2">
                You play as
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["X", "O"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setHumanSeat(p)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition-all",
                      p === "X" ? "bg-player-x-soft" : "bg-player-o-soft",
                      humanSeat === p
                        ? "ring-4 ring-offset-1 ring-offset-background " +
                          (p === "X" ? "ring-player-x" : "ring-player-o")
                        : "opacity-60 hover:opacity-100",
                    )}
                  >
                    <Mark player={p} size="sm" animate={false} />
                    <span>{p === "X" ? "X (first)" : "O (second)"}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase text-foreground/60 mb-2">
                Difficulty
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DIFFICULTIES.map((d) => {
                  const selected = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={cn(
                        "text-left rounded-2xl p-3 transition-all",
                        d.tone,
                        selected
                          ? "ring-4 ring-primary ring-offset-1 ring-offset-background scale-[1.01]"
                          : "opacity-75 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center gap-2 font-display font-bold">
                        <span className="text-xl">{d.emoji}</span>
                        <span>{d.label}</span>
                      </div>
                      <p className="text-xs mt-1 opacity-90">{d.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={() => {
                setState(createInitialState());
                setStarted(true);
              }}
              size="lg"
              className="w-full rounded-2xl font-bold h-14 text-base"
              disabled={!playerName.trim()}
            >
              Start game
            </Button>

            <div className="text-center mt-4">
              <Link to="/rules" className="text-sm text-muted-foreground hover:text-primary">
                Need a refresher on the rules?
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <GameView
      state={state}
      playerX={playerX}
      playerO={playerO}
      mySeat={humanSeat}
      onMove={handleMove}
      onNewGame={reset}
      onResign={() => {
        if (confirm("Reset the game?")) reset();
      }}
    />
  );
}

function labelFor(d: BotDifficulty): string {
  switch (d) {
    case "easy": return "Easy";
    case "medium": return "Medium";
    case "hard": return "Hard";
    case "extra-hard": return "Extra Hard";
  }
}
