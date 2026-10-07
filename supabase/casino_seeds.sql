-- Provably fair seed pairs. Run in the MAIN Supabase project. Worker-only access (service key), RLS on, no policies.
-- One ACTIVE pair per player. Rotating marks it inactive and reveals the server seed to the player.
create table if not exists public.casino_seeds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  username    text not null,
  server_seed text not null,
  server_hash text not null,
  client_seed text not null,
  nonce       integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  revealed_at timestamptz
);
create unique index if not exists casino_seeds_one_active on public.casino_seeds (user_id) where active;
create index if not exists casino_seeds_user on public.casino_seeds (user_id, revealed_at desc);
create index if not exists casino_seeds_hash on public.casino_seeds (server_hash);
alter table public.casino_seeds enable row level security;


-- Provably fair for the shared games (Crash and Jackpot): one server seed per round.
-- The hash is public from creation, the seed is revealed after the round. Run BEFORE deploying the worker.
alter table public.crash_rounds   add column if not exists server_seed text;
alter table public.crash_rounds   add column if not exists server_hash text;
alter table public.jackpot_rounds add column if not exists server_seed text;
alter table public.jackpot_rounds add column if not exists server_hash text;
