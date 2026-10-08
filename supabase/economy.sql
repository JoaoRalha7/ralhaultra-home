-- Points economy (replaces StreamElements as source of truth).
-- Run in the MAIN Supabase project (the one with profiles). RLS on, no policies:
-- only the worker and the bot (service key) can read or write these tables.
-- Safe to run more than once. Does not touch points_ledger.

-- Tunable values (rates, caps, prices). Edit rows, no deploy needed.
create table if not exists public.economy_config (
  key         text primary key,
  value       jsonb not null,
  note        text,
  updated_at  timestamptz not null default now()
);

-- One row per viewer, keyed by lowercase Twitch username (same key the worker uses).
create table if not exists public.point_balances (
  username       text primary key check (username = lower(username)),
  twitch_id      text,
  balance        bigint not null default 0 check (balance >= 0),
  watch_minutes  bigint not null default 0,
  wagered_total  bigint not null default 0,
  level          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists point_balances_top on public.point_balances (balance desc);
create index if not exists point_balances_twitch_id on public.point_balances (twitch_id);

-- Every movement, positive or negative. balance_after makes audits trivial.
create table if not exists public.point_transactions (
  id             bigserial primary key,
  username       text not null,
  delta          bigint not null,
  balance_after  bigint not null,
  reason         text not null,
  ref            text,
  created_at     timestamptz not null default now()
);
create index if not exists point_transactions_user on public.point_transactions (username, created_at desc);
create index if not exists point_transactions_reason on public.point_transactions (reason, created_at desc);

-- VIP levels. Level comes from lifetime counters (wagered + watch hours), never from the balance.
create table if not exists public.vip_levels (
  level            integer primary key,
  name             text not null,
  min_wagered      bigint not null default 0,
  min_watch_hours  integer not null default 0,
  bonus_mult       numeric(4,2) not null default 0,   -- added to the sub multiplier
  cashback_pct     numeric(4,2) not null default 0
);

alter table public.economy_config      enable row level security;
alter table public.point_balances      enable row level security;
alter table public.point_transactions  enable row level security;
alter table public.vip_levels          enable row level security;

-- Atomic add/subtract. Never lets a balance go negative.
-- p_wagered: optional, adds to the lifetime wagered counter (casino bets).
create or replace function public.add_points(
  p_username text,
  p_delta    bigint,
  p_reason   text,
  p_ref      text default null,
  p_wagered  bigint default 0
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  u   text := lower(p_username);
  bal bigint;
begin
  if u is null or u = '' then raise exception 'invalid username'; end if;

  insert into point_balances (username) values (u) on conflict (username) do nothing;

  update point_balances
     set balance       = balance + p_delta,
         wagered_total = wagered_total + greatest(coalesce(p_wagered, 0), 0),
         updated_at    = now()
   where username = u
     and balance + p_delta >= 0
  returning balance into bal;

  if bal is null then raise exception 'insufficient points'; end if;

  insert into point_transactions (username, delta, balance_after, reason, ref)
  values (u, p_delta, bal, p_reason, p_ref);

  return bal;
end;
$$;

-- Watchtime tick for many viewers at once (called by the bot every minute while live).
-- p_rows: [{ "username": "x", "twitch_id": "123", "points": 100, "minutes": 1 }, ...]
create or replace function public.watch_tick(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r   jsonb;
  n   integer := 0;
  u   text;
  pts bigint;
  bal bigint;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    u   := lower(r->>'username');
    pts := coalesce((r->>'points')::bigint, 0);
    if u is null or u = '' then continue; end if;

    insert into point_balances (username, twitch_id) values (u, r->>'twitch_id')
    on conflict (username) do nothing;

    update point_balances
       set balance       = balance + pts,
           watch_minutes = watch_minutes + coalesce((r->>'minutes')::bigint, 1),
           twitch_id     = coalesce(twitch_id, r->>'twitch_id'),
           updated_at    = now()
     where username = u
    returning balance into bal;

    if pts <> 0 then
      insert into point_transactions (username, delta, balance_after, reason)
      values (u, pts, bal, 'watchtime');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.add_points(text, bigint, text, text, bigint) from public, anon, authenticated;
revoke all on function public.watch_tick(jsonb) from public, anon, authenticated;

-- Initial config (agreed values). ON CONFLICT DO NOTHING so re-running never overwrites edits.
insert into public.economy_config (key, value, note) values
  ('watch_points_per_hour', '6000',  'Base points per hour watched, live only'),
  ('daily_base',            '10000', 'Daily claim base'),
  ('daily_streak_bonus',    '1000',  'Added per streak day'),
  ('daily_streak_max_days', '7',     'Streak days that count'),
  ('sub_mult',              '{"0":1.0,"1":1.5,"2":1.75,"3":2.0}', 'Multiplier by sub tier (0 = not a sub)'),
  ('mult_cap',              '2.5',   'Max combined multiplier (sub + vip)'),
  ('min_account_age_days',  '7',     'Twitch account age required to earn'),
  ('require_follow',        'true',  'Must follow the channel to earn'),
  ('casino_min_bet',        '10',    'Minimum bet'),
  ('casino_max_bet',        '500',   'Hard ceiling for any bet'),
  ('casino_risk_cap',       '100000','Max bet per game = risk_cap / max multiplier of the game'),
  ('cashback_cap_week',     '50000', 'Max cashback per user per week')
on conflict (key) do nothing;

insert into public.vip_levels (level, name, min_wagered, min_watch_hours, bonus_mult, cashback_pct) values
  (0, 'Member',   0,          0,   0.0, 3),
  (1, 'Bronze',   250000,     10,  0.1, 4),
  (2, 'Silver',   1000000,    30,  0.2, 5),
  (3, 'Gold',     4000000,    80,  0.3, 6),
  (4, 'Platinum', 12000000,   160, 0.4, 7),
  (5, 'Diamond',  40000000,   300, 0.5, 8)
on conflict (level) do nothing;
