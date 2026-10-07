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

-- Keno, Plinko and Roulette (added later): allow every game value. Safe to run on an existing table, in any order.
alter table public.casino_games drop constraint if exists casino_games_game_check;
alter table public.casino_games add constraint casino_games_game_check check (game in ('mines','blackjack','crash','keno','plinko','roulette'));


-- Live Crash (shared rounds every ~15s). Run in the MAIN Supabase project. Worker-only access (service key).
create table if not exists public.crash_rounds (
  seq        bigint primary key,
  start_ms   bigint not null,
  crash_at   numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create table if not exists public.crash_bets (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint not null references public.crash_rounds(seq) on delete cascade,
  user_id    uuid not null,
  username   text not null,
  bet        integer not null,
  auto       numeric(10,2),
  cashed_at  numeric(10,2),
  payout     integer not null default 0,
  paid       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (seq, user_id)
);
create index if not exists crash_bets_user on public.crash_bets (user_id, created_at desc);
create index if not exists crash_bets_recent on public.crash_bets (created_at desc);
alter table public.crash_rounds enable row level security;
alter table public.crash_bets enable row level security;
