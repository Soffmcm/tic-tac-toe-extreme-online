import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/game/Header";
import { Mark } from "@/components/game/Mark";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "How to Play — Ultimate 3T" },
      {
        name: "description",
        content:
          "Learn the rules of Ultimate Tic-Tac-Toe in 60 seconds. Where you move sends your opponent where they have to play.",
      },
      { property: "og:title", content: "How to Play Ultimate Tic-Tac-Toe" },
      {
        property: "og:description",
        content: "The simple rules of the bigger, smarter Tic-Tac-Toe.",
      },
    ],
  }),
  component: Rules,
});

function MiniDemo({ highlight, marks }: { highlight?: number; marks?: Record<number, "X" | "O"> }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-2 rounded-2xl bg-board-line/80 aspect-square w-full max-w-[260px] mx-auto">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={`relative rounded-md bg-card flex items-center justify-center ${
            highlight === i ? "ring-4 ring-player-x" : ""
          }`}
        >
          {marks?.[i] && <Mark player={marks[i]} size="md" animate={false} />}
        </div>
      ))}
    </div>
  );
}

function Rules() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto max-w-3xl px-4 py-10 w-full">
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-3">
          How to play
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Ultimate Tic-Tac-Toe = nine tic-tac-toe boards arranged in a 3×3 grid.
          You'll learn it in a minute.
        </p>

        <ol className="space-y-12">
          <li>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
                1
              </span>
              <h2 className="font-display text-2xl font-bold m-0">
                Win three little boards in a row
              </h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Each of the 9 mini-boards is a regular tic-tac-toe game. Win three
              mini-boards in a row (across, down, or diagonal) and you win the
              whole game.
            </p>
          </li>

          <li>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
                2
              </span>
              <h2 className="font-display text-2xl font-bold m-0">
                Where you play decides where they play
              </h2>
            </div>
            <p className="text-muted-foreground mb-4">
              The cell you click determines which mini-board your opponent
              <em> must</em> play in next.
            </p>
            <div className="grid grid-cols-2 gap-6 items-center">
              <div>
                <p className="text-sm font-semibold mb-2">You play in cell 4 (the center)…</p>
                <MiniDemo marks={{ 4: "X" }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">…opponent must play in board 4.</p>
                <div className="grid grid-cols-3 gap-1 p-2 rounded-2xl bg-board-line/80 aspect-square w-full max-w-[260px] mx-auto">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-md bg-card ${
                        i === 4 ? "ring-4 ring-player-o" : "opacity-60"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </li>

          <li>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
                3
              </span>
              <h2 className="font-display text-2xl font-bold m-0">
                Sent to a finished board? Free choice.
              </h2>
            </div>
            <p className="text-muted-foreground">
              If the mini-board you'd be sent to is already won or full, you can
              play in <strong>any</strong> open mini-board you like. All open
              boards will glow.
            </p>
          </li>

          <li>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
                4
              </span>
              <h2 className="font-display text-2xl font-bold m-0">
                Win the meta-board, win the game
              </h2>
            </div>
            <p className="text-muted-foreground">
              First to claim three mini-boards in a row wins. If everything fills
              up with no winner, it's a draw.
            </p>
          </li>
        </ol>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="rounded-2xl font-bold">
            <Link to="/play/local">Try it locally</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-2xl font-bold">
            <Link to="/play/online">Play with a friend online</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
