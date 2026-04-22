import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Users, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/game/Header";
import { Mark } from "@/components/game/Mark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ultimate 3T — Tic-Tac-Toe Extreme, two-player online game" },
      {
        name: "description",
        content:
          "Play Ultimate Tic-Tac-Toe online or locally with a friend. Nine boards, one giant battle. Free, colorful, no signup required.",
      },
      { property: "og:title", content: "Ultimate 3T — Tic-Tac-Toe Extreme" },
      {
        property: "og:description",
        content:
          "A bigger, smarter Tic-Tac-Toe. Play online with a shareable link or pass-and-play locally.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero opacity-50 pointer-events-none" />
          <div className="absolute -top-20 -right-20 size-80 rounded-full bg-sunny/30 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-lavender/30 blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-5xl px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 text-center">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="inline-flex items-center gap-3 mb-6"
            >
              <Mark player="X" size="lg" />
              <span className="font-display text-3xl font-bold text-foreground/40">×</span>
              <Mark player="O" size="lg" />
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="font-display text-5xl sm:text-7xl font-bold leading-[0.95] tracking-tight"
            >
              Tic-Tac-Toe,
              <br />
              <span className="bg-gradient-sun bg-clip-text text-transparent">
                but ultimate.
              </span>
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-5 max-w-xl mx-auto text-lg sm:text-xl text-muted-foreground"
            >
              Nine little boards. One giant battle. Where you play sends your
              opponent where they have to play next.
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                asChild
                size="lg"
                className="h-14 px-8 text-base font-bold rounded-2xl shadow-soft hover:scale-105 transition-transform"
              >
                <Link to="/play/online">
                  <Globe className="!size-5" />
                  Play Online
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-14 px-8 text-base font-bold rounded-2xl shadow-pop hover:scale-105 transition-transform"
              >
                <Link to="/play/local">
                  <Users className="!size-5" />
                  Play Local
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6"
            >
              <Link
                to="/rules"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <Sparkles className="size-4" />
                New here? Learn the rules
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Feature row */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Pass & Play",
                desc: "Two players, one device. Perfect for the couch.",
                color: "bg-player-x-soft",
                emoji: "🎮",
              },
              {
                title: "Online Rooms",
                desc: "Create a room, share the link, and battle live.",
                color: "bg-player-o-soft",
                emoji: "🌐",
              },
              {
                title: "No Pressure",
                desc: "No timers, no ads. Take all the time you need.",
                color: "bg-secondary/60",
                emoji: "🌈",
              },
            ].map((f) => (
              <div
                key={f.title}
                className={`rounded-3xl p-6 ${f.color} shadow-pop`}
              >
                <div className="text-4xl mb-3">{f.emoji}</div>
                <h3 className="font-display text-xl font-bold mb-1">{f.title}</h3>
                <p className="text-sm text-foreground/70">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Made by <span className="font-bold text-foreground/80">Sofia Moura</span> · Ultimate 3T ·{" "}
        <Link to="/rules" className="hover:text-primary underline-offset-2 hover:underline">
          How to Play
        </Link>
      </footer>
    </div>
  );
}
