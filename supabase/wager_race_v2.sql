-- Wager Race v2: automatic prize payout + prize log + public feed. Run in the MAIN Supabase project (SQL Editor).
-- Safe to run more than once. Needs supabase/wager_race.sql and supabase/economy.sql already applied.

-- First period that pays prizes, per race (Europe/Lisbon time). Edit these dates if you want a later start.
create table if not exists public.wager_race_config (
  period text primary key,
  first_start timestamptz not null
);
insert into public.wager_race_config (period, first_start) values
  ('daily',   timestamp '2026-10-11 00:00' at time zone 'Europe/Lisbon'),
  ('weekly',  timestamp '2026-10-05 00:00' at time zone 'Europe/Lisbon'),
  ('monthly', timestamp '2026-10-01 00:00' at time zone 'Europe/Lisbon')
on conflict (period) do nothing;

-- One row per period already paid (guarantees a period is only paid once).
create table if not exists public.wager_race_closed (
  period text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz not null default now(),
  primary key (period, starts_at)
);

-- Prize log: one row per winner.
create table if not exists public.wager_race_prizes (
  id bigserial primary key,
  period text not null,
  starts_at timestamptz not null,
  rank int not null,
  username text not null,
  wagered bigint not null,
  prize bigint not null,
  created_at timestamptz not null default now(),
  unique (period, starts_at, rank)
);
create index if not exists wager_race_prizes_user on public.wager_race_prizes (username, created_at desc);
create index if not exists wager_race_prizes_created on public.wager_race_prizes (created_at desc);

alter table public.wager_race_config enable row level security;
alter table public.wager_race_closed enable row level security;
alter table public.wager_race_prizes enable row level security;

-- Prize ladder. KEEP IN SYNC with PRIZES in src/pages/WagerRace.jsx.
create or replace function public.wager_race_prize(p_period text, p_rank int)
returns bigint
language sql
immutable
as $$
  select case
    when p_rank < 1 or p_rank > 10 then 0
    when p_period = 'daily'   then (array[10000,5000,2000,1000,500,300,300,300,300,300])[p_rank]
    when p_period = 'weekly'  then (array[50000,25000,10000,5000,2500,1500,1500,1500,1500,1500])[p_rank]
    when p_period = 'monthly' then (array[125000,62500,25000,12500,6250,3750,3750,3750,3750,3750])[p_rank]
    else 0 end::bigint;
$$;

-- Pays the top 10 of every period that already ended and was not paid yet (looks back 3 periods, so a missed minute is harmless).
-- Called by the worker cron every minute. Idempotent and atomic.
create or replace function public.wager_race_settle()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  per text;
  now_l timestamp := now() at time zone 'Europe/Lisbon';
  cur_l timestamp;
  k int;
  s_l timestamp; e_l timestamp;
  s timestamptz; e timestamptz;
  first_s timestamptz;
  n int;
  r record;
  paid json := '[]'::json;
  cnt int := 0;
begin
  foreach per in array array['daily','weekly','monthly'] loop
    select first_start into first_s from wager_race_config where period = per;
    if first_s is null then continue; end if;
    cur_l := case per when 'daily' then date_trunc('day', now_l) when 'weekly' then date_trunc('week', now_l) else date_trunc('month', now_l) end;
    for k in 1..3 loop
      s_l := case per when 'daily' then cur_l - (k * interval '1 day') when 'weekly' then cur_l - (k * interval '7 days') else cur_l - (k * interval '1 month') end;
      e_l := case per when 'daily' then s_l + interval '1 day' when 'weekly' then s_l + interval '7 days' else s_l + interval '1 month' end;
      s := s_l at time zone 'Europe/Lisbon';
      e := e_l at time zone 'Europe/Lisbon';
      if s < first_s then continue; end if;

      insert into wager_race_closed (period, starts_at, ends_at) values (per, s, e) on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then continue; end if;   -- already paid

      for r in
        with w as (
          select lower(username) as u, sum(bet)::bigint as amt
          from (
            select username, bet from casino_games where status = 'done' and created_at >= s and created_at < e
            union all
            select username, bet from crash_bets where created_at >= s and created_at < e
            union all
            select en.username, en.amount from jackpot_entries en
              join jackpot_rounds jr on jr.seq = en.seq and jr.status = 'done'
              where en.created_at >= s and en.created_at < e
          ) x
          where lower(username) not in ('nightbot','streamelements','wizebot','moobot','fossabot','streamlabs')
          group by lower(username)
          having sum(bet) > 0
        )
        select u, amt, row_number() over (order by amt desc, u) as rk from w order by amt desc, u limit 10
      loop
        if wager_race_prize(per, r.rk::int) > 0 then
          insert into wager_race_prizes (period, starts_at, rank, username, wagered, prize)
            values (per, s, r.rk::int, r.u, r.amt, wager_race_prize(per, r.rk::int));
          perform add_points(r.u, wager_race_prize(per, r.rk::int), 'wagerrace:' || per || '#' || r.rk, per || ':' || to_char(s_l, 'YYYY-MM-DD'));
          cnt := cnt + 1;
        end if;
      end loop;
    end loop;
  end loop;
  return json_build_object('paid', cnt);
end;
$$;
revoke all on function public.wager_race_settle() from public, anon, authenticated;
grant execute on function public.wager_race_settle() to service_role;

-- Public feed (Home > Activity Feed > Giveaways & Raffles): who won, which race, how many points.
create or replace function public.recent_wager_prizes(lim int default 10)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(x), '[]'::json) from (
    select username, period, rank, prize as points, created_at
    from public.wager_race_prizes
    order by created_at desc, rank
    limit least(greatest(coalesce(lim,10),1), 50)
  ) x;
$$;
grant execute on function public.recent_wager_prizes(int) to anon, authenticated;
