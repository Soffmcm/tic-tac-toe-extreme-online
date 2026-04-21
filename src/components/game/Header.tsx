import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMuted, setMuted } from "@/lib/sounds";
import { Mark } from "./Mark";

export function Header() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex -space-x-1">
            <Mark player="X" size="sm" animate={false} />
            <Mark player="O" size="sm" animate={false} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            Ultimate <span className="text-primary">3T</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="font-semibold">
            <Link to="/rules" activeProps={{ className: "text-primary" }}>
              How to Play
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
        </nav>
      </div>
    </header>
  );
}
