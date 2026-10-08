-- Live VIP refresh for ONE user (wagered + level). Called by the Worker when /vip is opened and by the bot on !level.
-- Run AFTER economy_vip.sql.
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
            where w >= l.min_wagered and b.watch_minutes >= l.min_watch_hours * 60
         ), 0)
   where b.username = u;
end;
$$;

revoke all on function public.refresh_vip_user(text) from public, anon, authenticated;
