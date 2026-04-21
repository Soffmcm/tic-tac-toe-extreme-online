
drop policy if exists "rooms_insert_any" on public.rooms;

create policy "rooms_insert_self_as_x"
  on public.rooms for insert
  with check (
    (auth.uid() is not null and player_x_id = auth.uid())
    or (public.current_seat_token() is not null
        and player_x_token = public.current_seat_token())
  );
