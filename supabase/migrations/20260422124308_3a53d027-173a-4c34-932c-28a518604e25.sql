
-- Replace the previous make_move_secure with one that accepts identity explicitly
-- so it can be invoked safely by a trusted server function (which uses the
-- service role and won't be carrying the original x-seat-token header).
DROP FUNCTION IF EXISTS public.make_move_secure(UUID, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.make_move_secure(
  _room_id UUID,
  _expected_move_count INTEGER,
  _board_index INTEGER,
  _cell_index INTEGER,
  _user_id UUID,
  _seat_token TEXT
)
RETURNS public.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g public.games;
  caller_seat TEXT;
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
  IF _user_id IS NULL AND (_seat_token IS NULL OR length(_seat_token) = 0) THEN
    RAISE EXCEPTION 'Caller identity required';
  END IF;

  SELECT seat INTO caller_seat
  FROM public.room_seats
  WHERE room_id = _room_id
    AND (
      (_user_id IS NOT NULL AND user_id = _user_id)
      OR (_seat_token IS NOT NULL AND token = _seat_token)
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

REVOKE ALL ON FUNCTION public.make_move_secure(UUID, INTEGER, INTEGER, INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.make_move_secure(UUID, INTEGER, INTEGER, INTEGER, UUID, TEXT) TO service_role;

-- create_room_secure: atomically creates a room, X seat, and initial game.
CREATE OR REPLACE FUNCTION public.create_room_secure(
  _code TEXT,
  _user_id UUID,
  _seat_token TEXT,
  _nickname TEXT
)
RETURNS TABLE (room_id UUID, room_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_room public.rooms;
  empty_boards JSONB := jsonb_build_array(
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null)
  );
  empty_mini JSONB := jsonb_build_array(null,null,null,null,null,null,null,null,null);
BEGIN
  IF _code IS NULL OR length(_code) = 0 OR length(_code) > 32 THEN
    RAISE EXCEPTION 'Invalid room code';
  END IF;
  IF _user_id IS NULL AND (_seat_token IS NULL OR length(_seat_token) = 0) THEN
    RAISE EXCEPTION 'Caller identity required';
  END IF;
  IF _nickname IS NULL OR length(trim(_nickname)) = 0 THEN
    _nickname := 'Player X';
  END IF;
  IF length(_nickname) > 32 THEN
    _nickname := substring(_nickname, 1, 32);
  END IF;

  INSERT INTO public.rooms (code, status, player_x_id, player_x_name)
  VALUES (_code, 'waiting', _user_id, _nickname)
  RETURNING * INTO new_room;

  INSERT INTO public.room_seats (room_id, seat, user_id, token, nickname)
  VALUES (new_room.id, 'X', _user_id, CASE WHEN _user_id IS NULL THEN _seat_token ELSE NULL END, _nickname);

  INSERT INTO public.games (room_id, board_state, mini_winners, current_player, active_board, winner, move_count)
  VALUES (new_room.id, empty_boards, empty_mini, 'X', NULL, NULL, 0);

  room_id := new_room.id;
  room_code := new_room.code;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_room_secure(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_room_secure(TEXT, UUID, TEXT, TEXT) TO service_role;

-- join_room_secure: claims the O seat if free.
CREATE OR REPLACE FUNCTION public.join_room_secure(
  _room_id UUID,
  _user_id UUID,
  _seat_token TEXT,
  _nickname TEXT
)
RETURNS public.rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.rooms;
  existing_seat TEXT;
BEGIN
  IF _user_id IS NULL AND (_seat_token IS NULL OR length(_seat_token) = 0) THEN
    RAISE EXCEPTION 'Caller identity required';
  END IF;
  IF _nickname IS NULL OR length(trim(_nickname)) = 0 THEN
    _nickname := 'Player O';
  END IF;
  IF length(_nickname) > 32 THEN
    _nickname := substring(_nickname, 1, 32);
  END IF;

  SELECT * INTO r FROM public.rooms WHERE id = _room_id FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- If caller is already seated, no-op (return current room).
  SELECT seat INTO existing_seat FROM public.room_seats
  WHERE room_id = _room_id
    AND (
      (_user_id IS NOT NULL AND user_id = _user_id)
      OR (_seat_token IS NOT NULL AND token = _seat_token)
    )
  LIMIT 1;
  IF existing_seat IS NOT NULL THEN
    RETURN r;
  END IF;

  -- O seat must be free
  IF r.player_o_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.room_seats WHERE room_id = _room_id AND seat = 'O') THEN
    RAISE EXCEPTION 'Seat already taken';
  END IF;

  INSERT INTO public.room_seats (room_id, seat, user_id, token, nickname)
  VALUES (_room_id, 'O', _user_id, CASE WHEN _user_id IS NULL THEN _seat_token ELSE NULL END, _nickname);

  UPDATE public.rooms
  SET player_o_id = _user_id,
      player_o_name = _nickname,
      status = 'playing',
      updated_at = now()
  WHERE id = _room_id
  RETURNING * INTO r;

  RETURN r;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_room_secure(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_room_secure(UUID, UUID, TEXT, TEXT) TO service_role;

-- reset_game_secure: only callable by a seated player; resets the game state.
CREATE OR REPLACE FUNCTION public.reset_game_secure(
  _room_id UUID,
  _user_id UUID,
  _seat_token TEXT
)
RETURNS public.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g public.games;
  caller_seat TEXT;
  empty_boards JSONB := jsonb_build_array(
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null),
    jsonb_build_array(null,null,null,null,null,null,null,null,null)
  );
  empty_mini JSONB := jsonb_build_array(null,null,null,null,null,null,null,null,null);
BEGIN
  IF _user_id IS NULL AND (_seat_token IS NULL OR length(_seat_token) = 0) THEN
    RAISE EXCEPTION 'Caller identity required';
  END IF;

  SELECT seat INTO caller_seat
  FROM public.room_seats
  WHERE room_id = _room_id
    AND (
      (_user_id IS NOT NULL AND user_id = _user_id)
      OR (_seat_token IS NOT NULL AND token = _seat_token)
    )
  LIMIT 1;

  IF caller_seat IS NULL THEN
    RAISE EXCEPTION 'Not a player in this room';
  END IF;

  UPDATE public.games
  SET board_state = empty_boards,
      mini_winners = empty_mini,
      current_player = 'X',
      active_board = NULL,
      winner = NULL,
      move_count = 0,
      updated_at = now()
  WHERE room_id = _room_id
  RETURNING * INTO g;

  UPDATE public.rooms SET status = 'playing', winner = NULL, updated_at = now() WHERE id = _room_id;
  RETURN g;
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_game_secure(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_game_secure(UUID, UUID, TEXT) TO service_role;
