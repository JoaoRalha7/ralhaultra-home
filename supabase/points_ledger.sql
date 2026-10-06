-- Ledger used by the worker's /game/spend and /game/refund endpoints.
-- Run in the MAIN Supabase project (the one with profiles). RLS on, no policies:
-- only the worker (service key) can read or write it.
create table if not exists public.points_ledger (
  id          bigserial primary key,
  user_id     uuid not null,
  username    text not null,
  game        text not null,
  amount      integer not null,
  refunded    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists points_ledger_lookup on public.points_ledger (user_id, game, refunded, created_at desc);
alter table public.points_ledger enable row level security;
