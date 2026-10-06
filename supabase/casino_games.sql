-- Casino games (Mines, Blackjack, Crash). Run in the MAIN Supabase project.
-- State is written and read only by the worker (service key). RLS on, no policies.
create table if not exists public.casino_games (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  username    text not null,
  game        text not null check (game in ('mines','blackjack','crash')),
  bet         integer not null,
  state       jsonb not null,
  status      text not null default 'active' check (status in ('active','done')),
  payout      integer not null default 0,
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- one active round per user and game (blocks double starts)
create unique index if not exists casino_one_active on public.casino_games (user_id, game) where status = 'active';
create index if not exists casino_recent on public.casino_games (game, created_at desc);
alter table public.casino_games enable row level security;

-- Keno (added later): allow the new game value. Safe to run on an existing table.
alter table public.casino_games drop constraint if exists casino_games_game_check;
alter table public.casino_games add constraint casino_games_game_check check (game in ('mines','blackjack','crash','keno'));

-- Plinko and Roulette (added later)
alter table public.casino_games drop constraint if exists casino_games_game_check;
alter table public.casino_games add constraint casino_games_game_check check (game in ('mines','blackjack','crash','keno','plinko','roulette'));
