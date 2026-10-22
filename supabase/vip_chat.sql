-- VIP needs chat messages too, points only while you are active in chat, and a bonus for staying the whole stream.
-- Run in the MAIN project, after vip_watch_reset.sql. Safe to run more than once.

alter table public.point_balances add column if not exists chat_messages bigint not null default 0;
alter table public.vip_levels     add column if not exists min_chat_messages integer not null default 0;

-- Messages needed per level (edit these numbers any time, then run:  select public.refresh_vip();)
update public.vip_levels set min_chat_messages = 0    where level = 0;
update public.vip_levels set min_chat_messages = 100  where level = 1;
update public.vip_levels set min_chat_messages = 300  where level = 2;
update public.vip_levels set min_chat_messages = 800  where level = 3;
update public.vip_levels set min_chat_messages = 1500 where level = 4;
update public.vip_levels set min_chat_messages = 3000 where level = 5;

-- Whoever already has a level keeps it: they are credited with the messages that level asks for.
update public.point_balances b
   set chat_messages = l.min_chat_messages
  from public.vip_levels l
 where l.level = b.level and b.level > 0 and b.chat_messages < l.min_chat_messages;

-- Settings (only created when missing, so your own edits are never overwritten)
insert into public.economy_config (key, value, note) values
  ('chat_active_minutes', '20',  'Watch points are only paid to people who wrote in chat in the last N minutes (0 = off)'),
  ('session_bonus_step',  '0.1', 'Extra multiplier for every full hour watched in a row'),
  ('session_bonus_max',   '0.5', 'Maximum session bonus')
on conflict (key) do nothing;
update public.economy_config set value = '3' where key = 'mult_cap' and (value #>> '{}')::numeric < 3;

create or replace function public.refresh_vip()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update point_balances b
     set wagered_total = x.wagered
    from economy_period('-infinity', 'infinity') x
   where b.username = x.username and b.wagered_total <> x.wagered;

  update point_balances b
     set level = coalesce((
           select max(l.level) from vip_levels l
            where b.wagered_total >= l.min_wagered and (b.watch_minutes - b.vip_watch_base) >= l.min_watch_hours * 60
              and b.chat_messages >= l.min_chat_messages
         ), 0)
   where b.level is distinct from coalesce((
           select max(l.level) from vip_levels l
            where b.wagered_total >= l.min_wagered and (b.watch_minutes - b.vip_watch_base) >= l.min_watch_hours * 60
              and b.chat_messages >= l.min_chat_messages
         ), 0);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.refresh_vip_user(p_user text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u text := lower(p_user);
  w bigint;
begin
  select coalesce(sum(x), 0)::bigint into w from (
    select bet::bigint as x from casino_games where status = 'done' and lower(username) = u
    union all
    select bet::bigint from crash_bets where lower(username) = u
  ) t;

  update point_balances b
     set wagered_total = w,
         level = coalesce((
           select max(l.level) from vip_levels l
            where w >= l.min_wagered and (b.watch_minutes - b.vip_watch_base) >= l.min_watch_hours * 60
              and b.chat_messages >= l.min_chat_messages
         ), 0)
   where b.username = u;
end;
$$;

-- Bot: how many counted messages each person wrote since the last tick.  p_rows: [{ "username": "x", "twitch_id": "1", "n": 2 }]
create or replace function public.chat_tick(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  u text;
  k integer := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    u := lower(r->>'username');
    if u is null or u = '' then continue; end if;
    insert into point_balances (username, twitch_id) values (u, r->>'twitch_id') on conflict (username) do nothing;
    update point_balances
       set chat_messages = chat_messages + greatest(coalesce((r->>'n')::integer, 0), 0),
           twitch_id     = coalesce(twitch_id, r->>'twitch_id')
     where username = u;
    k := k + 1;
  end loop;
  return k;
end;
$$;

-- watch_tick v3: same as v2, plus the session bonus (rows carry "session_min" = minutes watched in a row this stream).
create or replace function public.watch_tick(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     jsonb;
  n     integer := 0;
  u     text;
  pts   bigint;
  bal   bigint;
  vb    numeric;
  sb    numeric;
  m     numeric;
  base  numeric := coalesce((select (value #>> '{}')::numeric from economy_config where key = 'watch_points_per_hour'), 6000) / 60;
  cap   numeric := coalesce((select (value #>> '{}')::numeric from economy_config where key = 'mult_cap'), 3);
  sm    jsonb   := coalesce((select value from economy_config where key = 'sub_mult'), '{"0":1}'::jsonb);
  sstep numeric := coalesce((select (value #>> '{}')::numeric from economy_config where key = 'session_bonus_step'), 0.1);
  smax  numeric := coalesce((select (value #>> '{}')::numeric from economy_config where key = 'session_bonus_max'), 0.5);
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    u := lower(r->>'username');
    if u is null or u = '' then continue; end if;

    insert into point_balances (username, twitch_id) values (u, r->>'twitch_id')
    on conflict (username) do nothing;

    if r ? 'points' then
      pts := coalesce((r->>'points')::bigint, 0);
    else
      vb := 0;
      select coalesce(l.bonus_mult, 0) into vb
        from point_balances b join vip_levels l on l.level = b.level where b.username = u;
      sb := least(smax, floor(coalesce((r->>'session_min')::numeric, 0) / 60) * sstep);
      m := least(cap, coalesce((sm ->> coalesce(r->>'sub_tier', '0'))::numeric, 1) + coalesce(vb, 0) + sb);
      pts := case when coalesce((r->>'eligible')::boolean, true) then round(base * m)::bigint else 0 end;
    end if;

    update point_balances
       set balance       = balance + pts,
           watch_minutes = watch_minutes + 1,
           twitch_id     = coalesce(twitch_id, r->>'twitch_id'),
           updated_at    = now()
     where username = u
    returning balance into bal;

    if pts <> 0 then
      insert into point_transactions (username, delta, balance_after, reason) values (u, pts, bal, 'watchtime');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.refresh_vip() from public, anon, authenticated;
revoke all on function public.refresh_vip_user(text) from public, anon, authenticated;
revoke all on function public.chat_tick(jsonb) from public, anon, authenticated;
revoke all on function public.watch_tick(jsonb) from public, anon, authenticated;
