import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/game/Header";
import { GameView } from "@/components/game/GameView";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getStoredNickname, setStoredNickname } from "@/lib/identity";
import {
  getStoredSymbol,
  setStoredSymbol,
  type PlayerSymbol,
  type SymbolMap,
} from "@/lib/symbols";
import { SymbolPicker } from "@/components/game/SymbolPicker";
import { getCallerIdentity } from "@/lib/api-client";
import {
  joinRoomFn,
  makeMoveFn,
  resetGameFn,
  getMySeatFn,
} from "@/server/game.functions";
import {
  applyMove,
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
  player_x_name: string;
  player_o_name: string | null;
  winner: string | null;
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
  const [mySeat, setMySeat] = useState<Player | null>(null);
  const seatLoadedRef = useRef(false);

  // Per-seat symbols. Each client owns its own seat's symbol and broadcasts it
  // to the room channel; we mirror the opponent's symbol when they announce it.
  const [symbols, setSymbols] = useState<SymbolMap>({ X: null, O: null });
  const [showSymbols, setShowSymbols] = useState(false);
  const symbolChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const oSeatTaken = !!room?.player_o_id || !!room?.player_o_name;
  const waitingForOpponent = !!room && !oSeatTaken;

  // Initial fetch + identity check + realtime subscriptions.
  useEffect(() => {
    let cancelled = false;
    let roomChannel: ReturnType<typeof supabase.channel> | null = null;
    let gameChannel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("id,code,status,player_x_id,player_o_id,player_x_name,player_o_name,winner")
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

      // Ask the server which seat (if any) we hold.
      try {
        const identity = await getCallerIdentity();
        const seatRes = await getMySeatFn({ data: { roomId: r.id, ...identity } });
        if (!cancelled) {
          setMySeat(seatRes.seat);
          seatLoadedRef.current = true;
        }
      } catch (err) {
        console.error("seat lookup failed:", err);
      }

      setLoading(false);

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

  // Re-check seat ownership when auth state changes.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      if (!room) return;
      try {
        const identity = await getCallerIdentity();
        const seatRes = await getMySeatFn({ data: { roomId: room.id, ...identity } });
        setMySeat(seatRes.seat);
      } catch {
        // ignore
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [room]);

  // Symbol sync: each client owns the symbol for its own seat and broadcasts
  // it to a per-room channel so the opponent sees it. New joiners ask for a
  // sync and existing peers re-broadcast their current symbol.
  useEffect(() => {
    if (!room || !mySeat) return;
    // Seed our seat with whatever this viewer last picked locally.
    const myStored = getStoredSymbol(mySeat);
    setSymbols((prev) => ({ ...prev, [mySeat]: myStored }));

    const channel = supabase.channel(`symbols:${room.id}`, {
      config: { broadcast: { self: false } },
    });
    symbolChannelRef.current = channel;

    channel
      .on("broadcast", { event: "symbol" }, ({ payload }) => {
        const seat = payload?.seat as Player | undefined;
        const value = payload?.value as PlayerSymbol | undefined;
        if (seat === "X" || seat === "O") {
          setSymbols((prev) => ({ ...prev, [seat]: value ?? null }));
        }
      })
      .on("broadcast", { event: "sync_request" }, () => {
        // Re-announce our own symbol so the new peer can see it.
        channel.send({
          type: "broadcast",
          event: "symbol",
          payload: { seat: mySeat, value: getStoredSymbol(mySeat) },
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Announce our current symbol and request the opponent's.
          channel.send({
            type: "broadcast",
            event: "symbol",
            payload: { seat: mySeat, value: myStored },
          });
          channel.send({
            type: "broadcast",
            event: "sync_request",
            payload: { from: mySeat },
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      symbolChannelRef.current = null;
    };
  }, [room, mySeat]);

  const updateMySymbol = (value: PlayerSymbol) => {
    if (!mySeat) return;
    setSymbols((prev) => ({ ...prev, [mySeat]: value }));
    setStoredSymbol(mySeat, value);
    symbolChannelRef.current?.send({
      type: "broadcast",
      event: "symbol",
      payload: { seat: mySeat, value },
    });
  };

  const claimOSeat = async (name: string) => {
    if (!room) return;
    setStoredNickname(name);
    try {
      const identity = await getCallerIdentity();
      await joinRoomFn({
        data: { roomId: room.id, nickname: name, ...identity },
      });
      // Refresh seat info.
      const seatRes = await getMySeatFn({ data: { roomId: room.id, ...identity } });
      setMySeat(seatRes.seat);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't join — the seat may already be taken.");
    }
  };

  const handleMove = async (boardIndex: number, cellIndex: number) => {
    if (!room || !game || !mySeat) return;
    const current = rowToState(game);
    if (current.currentPlayer !== mySeat) return;
    const next = applyMove(current, boardIndex, cellIndex);
    if (!next) return;

    // Optimistic update — server will overwrite via realtime if it disagrees.
    const prevGame = game;
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

    try {
      const identity = await getCallerIdentity();
      await makeMoveFn({
        data: {
          roomId: room.id,
          expectedMoveCount: game.move_count,
          boardIndex,
          cellIndex,
          ...identity,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Move rejected — refreshing.");
      setGame(prevGame);
    }
  };

  const newGame = async () => {
    if (!room) return;
    try {
      const identity = await getCallerIdentity();
      await resetGameFn({ data: { roomId: room.id, ...identity } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start a new game.");
    }
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
    <>
      <GameView
        state={state}
        mySeat={mySeat}
        symbols={symbols}
        playerX={{ name: room.player_x_name || "Player 1", player: "X" }}
        playerO={{ name: room.player_o_name || "Player 2", player: "O" }}
        onMove={handleMove}
        onNewGame={state.winner ? newGame : undefined}
        onResign={undefined}
        inviteUrl={inviteUrl}
        waitingForOpponent={waitingForOpponent}
      />

      {/* Floating "customize symbol" panel — only the viewer's seat. */}
      <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)]">
        {showSymbols ? (
          <div className="bg-card border border-border rounded-2xl shadow-pop p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase text-foreground/60">
                Your symbol
              </div>
              <button
                type="button"
                onClick={() => setShowSymbols(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <SymbolPicker
              seat={mySeat}
              value={symbols[mySeat]}
              onChange={updateMySymbol}
              compact
            />
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowSymbols(true)}
              className="rounded-full font-bold shadow-pop"
            >
              ✨ Symbol
            </Button>
          </div>
        )}
      </div>
    </>
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
