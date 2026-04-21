import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/game/Header";
import { GameView } from "@/components/game/GameView";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getRoomClient } from "@/integrations/supabase/room-client";
import { getSeatToken, getStoredNickname, setStoredNickname } from "@/lib/identity";
import {
  applyMove,
  createInitialState,
  type Cell,
  type GameState,
  type MiniBoardResult,
  type Player,
} from "@/lib/game-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/play/$roomCode")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.roomCode} — Ultimate 3T` },
      {
        name: "description",
        content: "Live online Ultimate Tic-Tac-Toe match. Join the room!",
      },
    ],
  }),
  component: OnlineGame,
});

interface RoomRow {
  id: string;
  code: string;
  status: string;
  player_x_id: string | null;
  player_o_id: string | null;
  player_x_token: string | null;
  player_o_token: string | null;
  player_x_name: string;
  player_o_name: string | null;
  winner: "X" | "O" | "draw" | null;
}

interface GameRow {
  id: string;
  room_id: string;
  board_state: Cell[][];
  mini_winners: MiniBoardResult[];
  current_player: Player;
  active_board: number | null;
  winner: "X" | "O" | "draw" | null;
  move_count: number;
}

function rowToState(g: GameRow): GameState {
  return {
    boards: g.board_state,
    miniWinners: g.mini_winners,
    currentPlayer: g.current_player,
    activeBoard: g.active_board,
    winner: g.winner,
    history: Array.from({ length: g.move_count }, (_, i) => ({
      player: i % 2 === 0 ? "X" : "O",
      boardIndex: 0,
      cellIndex: 0,
    })),
  };
}

function OnlineGame() {
  const { roomCode } = Route.useParams();

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);

  const seatToken = useMemo(() => getSeatToken(), []);
  const seatTokenRef = useRef(seatToken);

  // Determine my seat in the room.
  const mySeat: Player | null = useMemo(() => {
    if (!room) return null;
    if (authedUserId) {
      if (room.player_x_id === authedUserId) return "X";
      if (room.player_o_id === authedUserId) return "O";
    }
    if (room.player_x_token && room.player_x_token === seatTokenRef.current) return "X";
    if (room.player_o_token && room.player_o_token === seatTokenRef.current) return "O";
    return null;
  }, [room, authedUserId]);

  const isSpectator = !mySeat && !!room && !!room.player_o_id || !!room?.player_o_token;
  const oSeatTaken = !!room?.player_o_id || !!room?.player_o_token;
  const waitingForOpponent = !!room && !oSeatTaken;

  // Initial fetch + auth check + realtime subscriptions.
  useEffect(() => {
    let cancelled = false;
    let roomChannel: ReturnType<typeof supabase.channel> | null = null;
    let gameChannel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuthedUserId(sess.session?.user?.id ?? null);

      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();
      if (cancelled) return;
      if (rErr || !r) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(r as RoomRow);

      const { data: g } = await supabase
        .from("games")
        .select("*")
        .eq("room_id", r.id)
        .maybeSingle();
      if (cancelled) return;
      if (g) setGame(g as unknown as GameRow);
      setLoading(false);

      // Subscribe to realtime updates for this room and game.
      roomChannel = supabase
        .channel(`room:${r.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${r.id}` },
          (payload) => {
            if (payload.new) setRoom(payload.new as RoomRow);
          },
        )
        .subscribe();

      gameChannel = supabase
        .channel(`game:${r.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "games", filter: `room_id=eq.${r.id}` },
          (payload) => {
            if (payload.new) setGame(payload.new as unknown as GameRow);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (roomChannel) supabase.removeChannel(roomChannel);
      if (gameChannel) supabase.removeChannel(gameChannel);
    };
  }, [roomCode]);

  // Watch auth changes too.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthedUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const claimOSeat = async (name: string) => {
    if (!room) return;
    setStoredNickname(name);
    const client = getRoomClient(seatTokenRef.current);
    const { data: updated, error } = await client
      .from("rooms")
      .update({
        player_o_id: authedUserId,
        player_o_token: authedUserId ? null : seatTokenRef.current,
        player_o_name: name,
        status: "playing",
      })
      .eq("id", room.id)
      .is("player_o_token", null)
      .is("player_o_id", null)
      .select()
      .maybeSingle();
    if (error || !updated) {
      toast.error("Couldn't join — the seat may already be taken.");
    }
  };

  const handleMove = async (boardIndex: number, cellIndex: number) => {
    if (!room || !game || !mySeat) return;
    const current = rowToState(game);
    if (current.currentPlayer !== mySeat) return;
    const next = applyMove(current, boardIndex, cellIndex);
    if (!next) return;

    // Optimistic update
    setGame((g) =>
      g
        ? {
            ...g,
            board_state: next.boards,
            mini_winners: next.miniWinners,
            current_player: next.currentPlayer,
            active_board: next.activeBoard,
            winner: next.winner,
            move_count: g.move_count + 1,
          }
        : g,
    );

    const client = getRoomClient(seatTokenRef.current);
    const { error } = await client
      .from("games")
      .update({
        board_state: next.boards,
        mini_winners: next.miniWinners,
        current_player: next.currentPlayer,
        active_board: next.activeBoard,
        winner: next.winner,
        move_count: game.move_count + 1,
      })
      .eq("id", game.id)
      .eq("move_count", game.move_count); // optimistic concurrency
    if (error) {
      console.error(error);
      toast.error("Move rejected — refreshing.");
    }

    if (next.winner) {
      await client
        .from("rooms")
        .update({ status: "finished", winner: next.winner })
        .eq("id", room.id);
    }
  };

  const newGame = async () => {
    if (!room || !game) return;
    const init = createInitialState();
    const client = getRoomClient(seatTokenRef.current);
    await client
      .from("games")
      .update({
        board_state: init.boards,
        mini_winners: init.miniWinners,
        current_player: "X",
        active_board: null,
        winner: null,
        move_count: 0,
      })
      .eq("id", game.id);
    await client
      .from("rooms")
      .update({ status: "playing", winner: null })
      .eq("id", room.id);
  };

  if (loading) {
    return <CenteredMsg title="Loading room…" />;
  }
  if (notFound) {
    return (
      <CenteredMsg title="Room not found" subtitle="The code might be wrong, or the room expired.">
        <Button asChild className="rounded-2xl font-bold">
          <Link to="/play/online">Back to lobby</Link>
        </Button>
      </CenteredMsg>
    );
  }
  if (!room) return null;

  // Joining as O if seat is open and we're not already seated.
  if (!mySeat && !oSeatTaken) {
    return <JoinAsOForm room={room} onJoin={claimOSeat} />;
  }

  if (!mySeat) {
    return (
      <CenteredMsg
        title="Room is full"
        subtitle="Both seats are taken. You can spectate below."
      >
        <Button asChild variant="secondary" className="rounded-2xl font-bold">
          <Link to="/play/online">Back to lobby</Link>
        </Button>
      </CenteredMsg>
    );
  }

  if (!game) return <CenteredMsg title="Setting up the game…" />;

  const state = rowToState(game);
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play/${room.code}`
      : null;

  return (
    <GameView
      state={state}
      mySeat={mySeat}
      playerX={{ name: room.player_x_name || "Player X", player: "X" }}
      playerO={{ name: room.player_o_name || "Player O", player: "O" }}
      onMove={handleMove}
      onNewGame={state.winner ? newGame : undefined}
      onResign={undefined}
      inviteUrl={inviteUrl}
      waitingForOpponent={waitingForOpponent}
    />
  );
}

function JoinAsOForm({
  room,
  onJoin,
}: {
  room: RoomRow;
  onJoin: (name: string) => Promise<void>;
}) {
  const [nick, setNick] = useState(getStoredNickname(""));
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl shadow-pop border border-border p-6 sm:p-8 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Room {room.code}
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">
            <span className="text-player-x">{room.player_x_name}</span> wants to play!
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            You'll be playing as <span className="text-player-o font-bold">O</span>.
          </p>
          <Label htmlFor="nick" className="text-xs font-bold uppercase text-foreground/60 text-left block">
            Your nickname
          </Label>
          <Input
            id="nick"
            value={nick}
            maxLength={20}
            placeholder="e.g. Lucky Wolf"
            onChange={(e) => setNick(e.target.value)}
            className="mt-1 mb-4 text-base font-bold rounded-xl"
          />
          <Button
            onClick={async () => {
              if (!nick.trim()) return;
              setBusy(true);
              await onJoin(nick.trim());
              setBusy(false);
            }}
            size="lg"
            className="w-full rounded-2xl font-bold h-12"
            disabled={busy || !nick.trim()}
          >
            {busy ? "Joining…" : "Join the game"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function CenteredMsg({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground mb-6">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
