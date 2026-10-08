-- VIP watchtime counts only AFTER a reset; the profile keeps the lifetime watchtime.
-- Run in the MAIN project, after economy_vip.sql and economy_vip_live.sql. Safe to run more than once.
-- It does NOT reset anything by itself: run  select public.vip_reset_watch();  when you want everybody to start at 0h.

alter table public.point_balances add column if not exists vip_watch_base bigint not null default 0;

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
         ), 0)
   where b.level is distinct from coalesce((
           select max(l.level) from vip_levels l
            where b.wagered_total >= l.min_wagered and (b.watch_minutes - b.vip_watch_base) >= l.min_watch_hours * 60
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
         ), 0)
   where b.username = u;
end;
$$;

-- Start the VIP hours from 0 for everybody (lifetime watch_minutes is untouched), then recompute levels.
create or replace function public.vip_reset_watch()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  update point_balances set vip_watch_base = watch_minutes;
  return public.refresh_vip();
end;
$$;

revoke all on function public.refresh_vip() from public, anon, authenticated;
revoke all on function public.refresh_vip_user(text) from public, anon, authenticated;
revoke all on function public.vip_reset_watch() from public, anon, authenticated;
