import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, ArrowRight, UserPlus, LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/game/Header";
import { Mark } from "@/components/game/Mark";
import { supabase } from "@/integrations/supabase/client";
import { getRoomClient } from "@/integrations/supabase/room-client";
import {
  generateRoomCode,
  getSeatToken,
  getStoredNickname,
  setStoredNickname,
} from "@/lib/identity";
import { createInitialState } from "@/lib/game-engine";
import { toast } from "sonner";

export const Route = createFileRoute("/play/online")({
  head: () => ({
    meta: [
      { title: "Play online — Ultimate 3T" },
      {
        name: "description",
        content:
          "Create a room or join with a code to play Ultimate Tic-Tac-Toe live with a friend. No signup needed.",
      },
    ],
  }),
  component: OnlineLobby,
});

function OnlineLobby() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [authedUser, setAuthedUser] = useState<{ id: string; nickname: string } | null>(null);

  useEffect(() => {
    setNickname(getStoredNickname(""));
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (u) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", u.id)
          .maybeSingle();
        const nick = prof?.nickname || u.email?.split("@")[0] || "Player";
        setAuthedUser({ id: u.id, nickname: nick });
        setNickname((prev) => prev || nick);
      }
    });
  }, []);

  const createRoom = async () => {
    const name = nickname.trim() || "Player X";
    if (!name) return;
    setStoredNickname(name);
    setCreating(true);

    const seatToken = getSeatToken();
    const client = getRoomClient(seatToken);
    const code = generateRoomCode();
    const initial = createInitialState();

    try {
      const { data: room, error: roomErr } = await client
        .from("rooms")
        .insert({
          code,
          status: "waiting",
          player_x_id: authedUser?.id ?? null,
          player_x_token: authedUser ? null : seatToken,
          player_x_name: name,
        })
        .select()
        .single();
      if (roomErr || !room) throw roomErr ?? new Error("Failed to create room");

      const { error: gameErr } = await client.from("games").insert({
        room_id: room.id,
        board_state: initial.boards,
        mini_winners: initial.miniWinners,
        current_player: "X",
        active_board: null,
        winner: null,
        move_count: 0,
      });
      if (gameErr) throw gameErr;

      navigate({ to: "/play/$roomCode", params: { roomCode: code } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create room. Try again.");
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const name = nickname.trim() || "Player O";
    setStoredNickname(name);
    setJoining(true);
    try {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("id, code, player_x_id, player_o_id, player_x_token, player_o_token, status")
        .eq("code", code)
        .maybeSingle();
      if (error || !room) {
        toast.error("Room not found.");
        setJoining(false);
        return;
      }
      navigate({ to: "/play/$roomCode", params: { roomCode: room.code } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't join room.");
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Globe className="size-5 text-primary" />
              <span className="font-display font-bold uppercase text-xs tracking-widest text-muted-foreground">
                Online
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">
              Play with a friend
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create a room and share the link, or join with a code.
            </p>
          </div>

          {/* Nickname */}
          <div className="bg-card rounded-3xl p-5 shadow-pop border border-border mb-5">
            <Label htmlFor="nick" className="text-xs font-bold uppercase text-foreground/60">
              Your nickname
            </Label>
            <Input
              id="nick"
              value={nickname}
              maxLength={20}
              placeholder="e.g. Sunny Otter"
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 text-base font-bold rounded-xl"
            />
            {!authedUser && (
              <p className="text-xs text-muted-foreground mt-2">
                Playing as a guest.{" "}
                <Link to="/auth" className="text-primary font-semibold hover:underline">
                  Sign in
                </Link>{" "}
                to track your wins.
              </p>
            )}
            {authedUser && (
              <p className="text-xs text-muted-foreground mt-2">
                Signed in as <span className="font-bold">{authedUser.nickname}</span> ·{" "}
                <Link to="/profile" className="text-primary font-semibold hover:underline">
                  Profile
                </Link>
              </p>
            )}
          </div>

          {/* Create room */}
          <div className="bg-player-x-soft rounded-3xl p-6 shadow-pop mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Mark player="X" size="md" animate={false} />
              <div>
                <div className="font-display text-xl font-bold">Create a room</div>
                <div className="text-sm text-foreground/70">
                  You'll play as X. Share the link with a friend.
                </div>
              </div>
            </div>
            <Button
              onClick={createRoom}
              size="lg"
              disabled={creating || !nickname.trim()}
              className="w-full rounded-2xl font-bold h-12"
            >
              {creating ? "Creating…" : "Create new room"}
              <ArrowRight className="!size-4" />
            </Button>
          </div>

          {/* Join room */}
          <div className="bg-player-o-soft rounded-3xl p-6 shadow-pop">
            <div className="flex items-center gap-3 mb-3">
              <Mark player="O" size="md" animate={false} />
              <div>
                <div className="font-display text-xl font-bold">Join a room</div>
                <div className="text-sm text-foreground/70">
                  Got a code? Drop it in.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="BRAVE-FOX-42"
                maxLength={32}
                className="rounded-xl font-mono font-bold uppercase"
              />
              <Button
                onClick={joinRoom}
                disabled={joining || !joinCode.trim() || !nickname.trim()}
                variant="default"
                className="rounded-2xl font-bold"
              >
                {joining ? "…" : "Join"}
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            {!authedUser ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth" search={{ mode: "signin" }}>
                    <LogIn className="!size-4" />
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    <UserPlus className="!size-4" />
                    Sign up
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link to="/profile">View profile</Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
