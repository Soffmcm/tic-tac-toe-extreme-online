
-- Lock down the updated_at function search path
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper: read the seat token from the request header that the client sets.
-- Clients send `x-seat-token: <token>` on every PostgREST request.
create or replace function public.current_seat_token()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  t text;
begin
  begin
    t := current_setting('request.headers', true)::json ->> 'x-seat-token';
  exception when others then
    t := null;
  end;
  return nullif(t, '');
end;
$$;

-- Helper: does the current request own a seat in the given room?
create or replace function public.is_room_player(_room_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = _room_id
      and (
        (auth.uid() is not null and (auth.uid() = r.player_x_id or auth.uid() = r.player_o_id))
        or
        (public.current_seat_token() is not null
          and (public.current_seat_token() = r.player_x_token
               or public.current_seat_token() = r.player_o_token))
      )
  );
$$;

-- =========================================================
-- ROOMS — replace permissive update policy with a strict one
-- =========================================================
drop policy if exists "rooms_update_player" on public.rooms;

-- Allow updating a room when:
--  (a) the row currently has an open seat (player_o_id IS NULL AND player_o_token IS NULL)
--      → anyone can claim the open seat, OR
--  (b) the requester already occupies one of the seats (by uid or seat token).
create policy "rooms_update_strict"
  on public.rooms for update
  using (
    (player_o_id is null and player_o_token is null)
    or (auth.uid() is not null and (auth.uid() = player_x_id or auth.uid() = player_o_id))
    or (public.current_seat_token() is not null
        and (public.current_seat_token() = player_x_token
             or public.current_seat_token() = player_o_token))
  )
  with check (
    -- After update, requester must be one of the seated players (prevents stealing seats from others).
    (auth.uid() is not null and (auth.uid() = player_x_id or auth.uid() = player_o_id))
    or (public.current_seat_token() is not null
        and (public.current_seat_token() = player_x_token
             or public.current_seat_token() = player_o_token))
  );

-- =========================================================
-- GAMES — replace permissive insert/update with strict
-- =========================================================
drop policy if exists "games_insert_any" on public.games;
drop policy if exists "games_update_any" on public.games;

create policy "games_insert_room_player"
  on public.games for insert
  with check (public.is_room_player(room_id));

create policy "games_update_room_player"
  on public.games for update
  using (public.is_room_player(room_id))
  with check (public.is_room_player(room_id));
