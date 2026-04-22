
-- 0) Drop client-write policies on rooms and games FIRST so we can safely drop columns later.
DROP POLICY IF EXISTS "rooms_insert_self_as_x" ON public.rooms;
DROP POLICY IF EXISTS "rooms_update_strict" ON public.rooms;
DROP POLICY IF EXISTS "games_insert_room_player" ON public.games;
DROP POLICY IF EXISTS "games_update_room_player" ON public.games;

-- 1) New room_seats table holding the secret tokens, isolated from public rooms reads
CREATE TABLE public.room_seats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  seat TEXT NOT NULL CHECK (seat IN ('X', 'O')),
  user_id UUID,
  token TEXT,
  nickname TEXT NOT NULL DEFAULT 'Player',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat),
  CHECK (user_id IS NOT NULL OR token IS NOT NULL)
);

CREATE INDEX idx_room_seats_room_id ON public.room_seats(room_id);
CREATE INDEX idx_room_seats_token ON public.room_seats(token) WHERE token IS NOT NULL;
CREATE INDEX idx_room_seats_user_id ON public.room_seats(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.room_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_seats_select_own"
  ON public.room_seats FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (public.current_seat_token() IS NOT NULL AND public.current_seat_token() = token)
  );

CREATE TRIGGER tr_room_seats_updated_at
  BEFORE UPDATE ON public.room_seats
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) Migrate existing tokens from rooms -> room_seats
INSERT INTO public.room_seats (room_id, seat, user_id, token, nickname)
SELECT id, 'X', player_x_id, player_x_token, COALESCE(player_x_name, 'Player X')
FROM public.rooms
WHERE player_x_id IS NOT NULL OR player_x_token IS NOT NULL
ON CONFLICT (room_id, seat) DO NOTHING;

INSERT INTO public.room_seats (room_id, seat, user_id, token, nickname)
SELECT id, 'O', player_o_id, player_o_token, COALESCE(player_o_name, 'Player O')
FROM public.rooms
WHERE player_o_id IS NOT NULL OR player_o_token IS NOT NULL
ON CONFLICT (room_id, seat) DO NOTHING;

-- 3) Drop the token columns from rooms.
ALTER TABLE public.rooms DROP COLUMN player_x_token;
ALTER TABLE public.rooms DROP COLUMN player_o_token;

-- 4) Update is_room_player to use room_seats.
CREATE OR REPLACE FUNCTION public.is_room_player(_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_seats s
    WHERE s.room_id = _room_id
      AND (
        (auth.uid() IS NOT NULL AND s.user_id = auth.uid())
        OR (public.current_seat_token() IS NOT NULL AND s.token = public.current_seat_token())
      )
  );
$function$;

-- 5) Server-side move validation function.
CREATE OR REPLACE FUNCTION public.make_move_secure(
  _room_id UUID,
  _expected_move_count INTEGER,
  _board_index INTEGER,
  _cell_index INTEGER
)
RETURNS public.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g public.games;
  caller_seat TEXT;
  uid UUID := auth.uid();
  st TEXT := public.current_seat_token();
  boards JSONB;
  mini JSONB;
  cell JSONB;
  cells JSONB;
  next_player TEXT;
  next_active INTEGER;
  next_winner TEXT;
  resolved_count INTEGER;
  meta_winner TEXT;
  win_lines INTEGER[][] := ARRAY[
    ARRAY[0,1,2], ARRAY[3,4,5], ARRAY[6,7,8],
    ARRAY[0,3,6], ARRAY[1,4,7], ARRAY[2,5,8],
    ARRAY[0,4,8], ARRAY[2,4,6]
  ];
  line INTEGER[];
  a TEXT; b TEXT; c TEXT;
  full_count INTEGER;
BEGIN
  IF _board_index < 0 OR _board_index > 8 OR _cell_index < 0 OR _cell_index > 8 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;

  SELECT seat INTO caller_seat
  FROM public.room_seats
  WHERE room_id = _room_id
    AND (
      (uid IS NOT NULL AND user_id = uid)
      OR (st IS NOT NULL AND token = st)
    )
  LIMIT 1;

  IF caller_seat IS NULL THEN
    RAISE EXCEPTION 'Not a player in this room';
  END IF;

  SELECT * INTO g FROM public.games WHERE room_id = _room_id FOR UPDATE;
  IF g.id IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF g.move_count <> _expected_move_count THEN
    RAISE EXCEPTION 'Stale move (expected % got %)', g.move_count, _expected_move_count;
  END IF;

  IF g.winner IS NOT NULL THEN
    RAISE EXCEPTION 'Game already finished';
  END IF;

  IF g.current_player <> caller_seat THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  IF g.active_board IS NOT NULL AND g.active_board <> _board_index THEN
    RAISE EXCEPTION 'Wrong mini-board';
  END IF;

  boards := g.board_state;
  mini   := g.mini_winners;

  IF jsonb_typeof(mini -> _board_index) <> 'null' THEN
    RAISE EXCEPTION 'Mini-board already finished';
  END IF;

  cell := boards -> _board_index -> _cell_index;
  IF jsonb_typeof(cell) <> 'null' THEN
    RAISE EXCEPTION 'Cell already taken';
  END IF;

  boards := jsonb_set(boards, ARRAY[_board_index::text, _cell_index::text], to_jsonb(caller_seat));
  cells := boards -> _board_index;

  FOREACH line SLICE 1 IN ARRAY win_lines LOOP
    a := cells ->> line[1];
    b := cells ->> line[2];
    c := cells ->> line[3];
    IF a IS NOT NULL AND a = b AND b = c THEN
      mini := jsonb_set(mini, ARRAY[_board_index::text], to_jsonb(a));
      EXIT;
    END IF;
  END LOOP;

  IF jsonb_typeof(mini -> _board_index) = 'null' THEN
    SELECT count(*) INTO full_count
    FROM jsonb_array_elements(cells) e
    WHERE jsonb_typeof(e) <> 'null';
    IF full_count = 9 THEN
      mini := jsonb_set(mini, ARRAY[_board_index::text], to_jsonb('draw'::text));
    END IF;
  END IF;

  IF jsonb_typeof(mini -> _cell_index) <> 'null' THEN
    next_active := NULL;
  ELSE
    SELECT count(*) INTO full_count
    FROM jsonb_array_elements(boards -> _cell_index) e
    WHERE jsonb_typeof(e) <> 'null';
    IF full_count = 9 THEN
      next_active := NULL;
    ELSE
      next_active := _cell_index;
    END IF;
  END IF;

  meta_winner := NULL;
  FOREACH line SLICE 1 IN ARRAY win_lines LOOP
    a := mini ->> line[1];
    b := mini ->> line[2];
    c := mini ->> line[3];
    IF a IS NOT NULL AND a IN ('X','O') AND a = b AND b = c THEN
      meta_winner := a;
      EXIT;
    END IF;
  END LOOP;

  IF meta_winner IS NULL THEN
    SELECT count(*) INTO resolved_count
    FROM jsonb_array_elements(mini) e
    WHERE jsonb_typeof(e) <> 'null';
    IF resolved_count = 9 THEN
      next_winner := 'draw';
    ELSE
      next_winner := NULL;
    END IF;
  ELSE
    next_winner := meta_winner;
  END IF;

  next_player := CASE caller_seat WHEN 'X' THEN 'O' ELSE 'X' END;
  IF next_winner IS NOT NULL THEN
    next_active := NULL;
  END IF;

  UPDATE public.games
  SET board_state = boards,
      mini_winners = mini,
      current_player = next_player,
      active_board = next_active,
      winner = next_winner,
      move_count = g.move_count + 1,
      updated_at = now()
  WHERE id = g.id
  RETURNING * INTO g;

  IF next_winner IS NOT NULL THEN
    UPDATE public.rooms
    SET status = 'finished', winner = next_winner, updated_at = now()
    WHERE id = _room_id;
  END IF;

  RETURN g;
END;
$function$;

REVOKE ALL ON FUNCTION public.make_move_secure(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.make_move_secure(UUID, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;
