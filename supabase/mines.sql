create table if not exists mines_games (
  id uuid primary key default gen_random_uuid(),
  twitch_username text not null,
  bet int not null,
  mines int not null,
  picks int not null,
  result text not null,
  payout int not null default 0,
  created_at timestamptz not null default now()
);
alter table mines_games enable row level security;
create policy "mines read" on mines_games for select using (true);
create policy "mines insert" on mines_games for insert with check (true);
notify pgrst, 'reload schema';
