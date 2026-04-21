
-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Player',
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', 'Player')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- ROOMS
-- =========================================================
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  player_x_id uuid references auth.users(id) on delete set null,
  player_o_id uuid references auth.users(id) on delete set null,
  player_x_name text not null default 'Player X',
  player_o_name text,
  -- Anonymous-friendly: a stable random token assigned to each browser claiming a seat,
  -- used as a fallback when there's no auth user.
  player_x_token text,
  player_o_token text,
  winner text check (winner in ('X','O','draw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_code_idx on public.rooms(code);
create index rooms_status_idx on public.rooms(status);

alter table public.rooms enable row level security;

-- Anyone can view rooms (so links/codes resolve).
create policy "rooms_select_all"
  on public.rooms for select
  using (true);

-- Anyone can create a room (guests included).
create policy "rooms_insert_any"
  on public.rooms for insert
  with check (true);

-- Updates allowed by either of the two assigned players.
-- Auth users match by auth.uid(); guests must match by token (validated on the server / via app logic).
create policy "rooms_update_player"
  on public.rooms for update
  using (
    (auth.uid() is not null and (auth.uid() = player_x_id or auth.uid() = player_o_id))
    or player_x_id is null
    or player_o_id is null
    or true  -- token-based identity is enforced in app code; broaden here so anonymous joiners can write
  );

-- =========================================================
-- GAMES
-- =========================================================
create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  -- Board state stored as JSON: array of 9 mini-boards, each an array of 9 cells (null|"X"|"O")
  board_state jsonb not null,
  mini_winners jsonb not null,         -- array length 9 of null|"X"|"O"|"draw"
  current_player text not null default 'X' check (current_player in ('X','O')),
  active_board integer,                -- 0..8 or null for free-choice
  winner text check (winner in ('X','O','draw')),
  move_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_room_idx on public.games(room_id);

alter table public.games enable row level security;

-- Anyone can view games (read-only for spectators / link openers).
create policy "games_select_all"
  on public.games for select
  using (true);

-- Inserts/updates: validated through the room (player must occupy a seat in that room).
-- For simplicity we allow update if the request can read the matching room and identity is checked at app level.
create policy "games_insert_any"
  on public.games for insert
  with check (true);

create policy "games_update_any"
  on public.games for update
  using (true);

-- =========================================================
-- updated_at triggers
-- =========================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.tg_set_updated_at();

create trigger games_updated_at
  before update on public.games
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- REALTIME
-- =========================================================
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.games;

alter table public.rooms replica identity full;
alter table public.games replica identity full;
