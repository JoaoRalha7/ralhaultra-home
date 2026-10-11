-- Wager Race (daily / weekly / monthly). Run in the MAIN Supabase project (SQL Editor).
-- Ranks players by points WAGERED on Originals inside the current period (Europe/Lisbon time):
--   daily = today, weekly = Monday to Sunday, monthly = calendar month.
-- Counts: casino_games (finished rounds), crash_bets, jackpot_entries of finished rounds. Bots are left out.
-- Public and read-only: returns usernames and totals only.
create index if not exists casino_games_created on public.casino_games (created_at);
create index if not exists jackpot_entries_created on public.jackpot_entries (created_at);

create or replace function public.wager_race(p_period text, p_limit int default 20, p_user text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  now_l timestamp := now() at time zone 'Europe/Lisbon';
  start_l timestamp;
  end_l timestamp;
  s timestamptz;
  e timestamptz;
  lim int := least(greatest(coalesce(p_limit, 20), 1), 100);
  me text := lower(nullif(trim(coalesce(p_user, '')), ''));
  out json;
begin
  if p_period = 'daily' then
    start_l := date_trunc('day', now_l); end_l := start_l + interval '1 day';
  elsif p_period = 'weekly' then
    start_l := date_trunc('week', now_l); end_l := start_l + interval '7 days';
  elsif p_period = 'monthly' then
    start_l := date_trunc('month', now_l); end_l := start_l + interval '1 month';
  else
    raise exception 'bad period';
  end if;
  s := start_l at time zone 'Europe/Lisbon';
  e := end_l at time zone 'Europe/Lisbon';

  with w as (
    select lower(username) as u, sum(bet)::bigint as amt
    from (
      select username, bet from casino_games where status = 'done' and created_at >= s and created_at < e
      union all
      select username, bet from crash_bets where created_at >= s and created_at < e
      union all
      select en.username, en.amount from jackpot_entries en
        join jackpot_rounds r on r.seq = en.seq and r.status = 'done'
        where en.created_at >= s and en.created_at < e
    ) x
    where lower(username) not in ('nightbot','streamelements','wizebot','moobot','fossabot','streamlabs')
    group by lower(username)
    having sum(bet) > 0
  ), ranked as (
    select u, amt, rank() over (order by amt desc) as rnk from w
  )
  select json_build_object(
    'starts_at', s,
    'ends_at', e,
    'players', (select count(*) from ranked),
    'total', coalesce((select sum(amt) from ranked), 0),
    'rows', coalesce((select json_agg(json_build_object('rank', rnk, 'username', u, 'wagered', amt) order by rnk, u) from ranked where rnk <= lim), '[]'::json),
    'me', (select json_build_object('rank', rnk, 'username', u, 'wagered', amt) from ranked where u = me limit 1)
  ) into out;
  return out;
end;
$$;
grant execute on function public.wager_race(text, int, text) to anon, authenticated;
