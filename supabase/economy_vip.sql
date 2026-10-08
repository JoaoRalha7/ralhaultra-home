-- VIP levels and weekly cashback. Run AFTER economy.sql. Safe to run more than once.
-- Both functions are called by the Worker cron (only when ECONOMY_SOURCE=supabase), and can be run by hand.

-- Lifetime wagered per user (all casino games + live crash). Crash payout = bet * cashed_at.
create or replace function public.economy_period(p_from timestamptz, p_to timestamptz)
returns table (username text, wagered bigint, paid bigint)
language sql
stable
security definer
set search_path = public
as $$
  select u, sum(w)::bigint, sum(p)::bigint
  from (
    select lower(username) as u, bet::bigint as w, payout::bigint as p
      from casino_games
     where status = 'done' and created_at >= p_from and created_at < p_to
    union all
    select lower(username), bet::bigint, coalesce(floor(bet * cashed_at), 0)::bigint
      from crash_bets
     where created_at >= p_from and created_at < p_to
  ) t
  group by u
$$;

-- Recompute wagered_total and level for everybody. Level needs BOTH: enough wagered and enough hours watched.
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
            where b.wagered_total >= l.min_wagered and b.watch_minutes >= l.min_watch_hours * 60
         ), 0)
   where b.level is distinct from coalesce((
           select max(l.level) from vip_levels l
            where b.wagered_total >= l.min_wagered and b.watch_minutes >= l.min_watch_hours * 60
         ), 0);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Cashback on NET losses of a period, by VIP level. Idempotent: one run per p_key (e.g. 'week:2026-10-12').
-- p_cap null = use economy_config.cashback_cap_week. Returns how many users were paid.
create or replace function public.run_cashback(p_key text, p_from timestamptz, p_to timestamptz, p_cap bigint default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  cap   bigint := coalesce(p_cap, (select (value #>> '{}')::bigint from economy_config where key = 'cashback_cap_week'), 50000);
  amt   bigint;
  n     integer := 0;
begin
  if exists (select 1 from point_transactions where reason = 'cashback:' || p_key) then return 0; end if;

  for r in
    select x.username, (x.wagered - x.paid) as loss,
           coalesce((select l.cashback_pct from vip_levels l where l.level = b.level), 0) as pct
      from economy_period(p_from, p_to) x
      join point_balances b on b.username = x.username
     where x.wagered > x.paid
  loop
    amt := least(floor(r.loss * r.pct / 100.0)::bigint, cap);
    if amt > 0 then
      perform add_points(r.username, amt, 'cashback:' || p_key);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke all on function public.economy_period(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.refresh_vip() from public, anon, authenticated;
revoke all on function public.run_cashback(text, timestamptz, timestamptz, bigint) from public, anon, authenticated;
