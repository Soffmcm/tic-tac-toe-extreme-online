import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/game/Header";
import { Mark } from "@/components/game/Mark";
import { GameView } from "@/components/game/GameView";
import { SymbolPicker } from "@/components/game/SymbolPicker";
import { applyMove, createInitialState, type GameState } from "@/lib/game-engine";
import {
  getStoredSymbol,
  setStoredSymbol,
  type PlayerSymbol,
  type SymbolMap,
} from "@/lib/symbols";

export const Route = createFileRoute("/play/local")({
  head: () => ({
    meta: [
      { title: "Local game — Ultimate 3T" },
      {
        name: "description",
        content: "Pass-and-play Ultimate Tic-Tac-Toe. Two players, one device.",
      },
    ],
  }),
  component: LocalPlay,
});

function LocalPlay() {
  const [started, setStarted] = useState(false);
  const [nameX, setNameX] = useState("Player 1");
  const [nameO, setNameO] = useState("Player 2");
  const [symbolX, setSymbolX] = useState<PlayerSymbol>(null);
  const [symbolO, setSymbolO] = useState<PlayerSymbol>(null);
  const [showSymbols, setShowSymbols] = useState(false);
  const [state, setState] = useState<GameState>(() => createInitialState());

  // Load stored symbols after mount to avoid SSR/client hydration mismatch.
  useEffect(() => {
    setSymbolX(getStoredSymbol("X"));
    setSymbolO(getStoredSymbol("O"));
  }, []);

  const symbols: SymbolMap = { X: symbolX, O: symbolO };

  const handleMove = (b: number, c: number) => {
    const next = applyMove(state, b, c);
    if (next) setState(next);
  };

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-card rounded-3xl shadow-pop border border-border p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <Users className="size-5 text-primary" />
                <span className="font-display font-bold uppercase text-xs tracking-widest text-muted-foreground">
                  Local Game
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold">Pass & Play</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Two players take turns on the same device.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-player-x-soft p-4 flex items-center gap-3">
                <Mark player="X" symbol={symbolX} size="md" animate={false} />
                <div className="flex-1">
                  <Label htmlFor="nameX" className="text-xs font-bold uppercase text-foreground/60">
                    Player 1
                  </Label>
                  <Input
                    id="nameX"
                    value={nameX}
                    maxLength={20}
                    onChange={(e) => setNameX(e.target.value)}
                    className="border-0 bg-transparent shadow-none px-0 text-base font-bold focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-player-o-soft p-4 flex items-center gap-3">
                <Mark player="O" symbol={symbolO} size="md" animate={false} />
                <div className="flex-1">
                  <Label htmlFor="nameO" className="text-xs font-bold uppercase text-foreground/60">
                    Player 2
                  </Label>
                  <Input
                    id="nameO"
                    value={nameO}
                    maxLength={20}
                    onChange={(e) => setNameO(e.target.value)}
                    className="border-0 bg-transparent shadow-none px-0 text-base font-bold focus-visible:ring-0"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSymbols((v) => !v)}
                className="w-full text-center text-sm font-semibold text-primary hover:underline"
              >
                {showSymbols ? "Hide symbols" : "Customize symbols ✨"}
              </button>

              {showSymbols && (
                <div className="space-y-4 border-t border-border pt-4">
                  <SymbolPicker
                    seat="X"
                    label="Player X symbol"
                    value={symbolX}
                    onChange={(v) => {
                      setSymbolX(v);
                      setStoredSymbol("X", v);
                    }}
                    compact
                  />
                  <SymbolPicker
                    seat="O"
                    label="Player O symbol"
                    value={symbolO}
                    onChange={(v) => {
                      setSymbolO(v);
                      setStoredSymbol("O", v);
                    }}
                    compact
                  />
                </div>
              )}
            </div>

            <Button
              onClick={() => {
                setState(createInitialState());
                setStarted(true);
              }}
              size="lg"
              className="w-full mt-6 rounded-2xl font-bold h-14 text-base"
              disabled={!nameX.trim() || !nameO.trim()}
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
      playerX={{ name: nameX || "Player X", player: "X" }}
      playerO={{ name: nameO || "Player O", player: "O" }}
      symbols={symbols}
      onMove={handleMove}
      onNewGame={() => setState(createInitialState())}
      onResign={() => {
        // In local play, resigning just resets — both players are present.
        if (confirm("Reset the game?")) setState(createInitialState());
      }}
    />
  );
}
