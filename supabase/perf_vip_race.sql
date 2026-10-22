-- Faster VIP page and Wager Race. Run in the MAIN project, after vip_chat.sql. Safe to run more than once.

-- Covering indexes: the sums are answered from the index alone
create index if not exists casino_games_done_created_cov on public.casino_games (created_at) include (username, bet) where status = 'done';
create index if not exists crash_bets_created_cov       on public.crash_bets   (created_at) include (username, bet);
create index if not exists jackpot_entries_created_cov  on public.jackpot_entries (created_at) include (seq, username, amount);
create index if not exists casino_games_done_user_cov   on public.casino_games (username) include (bet) where status = 'done';
create index if not exists crash_bets_user_cov          on public.crash_bets   (username) include (bet);

-- Same as before (wagered + level, with the chat messages rule) but uses the username index
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
    select bet::bigint as x from casino_games where status = 'done' and username = u
    union all
    select bet::bigint from crash_bets where username = u
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

-- This week's wagered and paid for ONE user (the weekly cashback estimate); no row limit
create or replace function public.user_period(p_user text, p_from timestamptz)
returns table (wagered bigint, paid bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(w), 0)::bigint, coalesce(sum(p), 0)::bigint
  from (
    select bet::bigint as w, payout::bigint as p from casino_games
     where username = lower(p_user) and status = 'done' and created_at >= p_from
    union all
    select bet::bigint, coalesce(floor(bet * cashed_at), 0)::bigint from crash_bets
     where username = lower(p_user) and created_at >= p_from
  ) t
$$;

revoke all on function public.refresh_vip_user(text) from public, anon, authenticated;
revoke all on function public.user_period(text, timestamptz) from public, anon, authenticated;
analyze public.casino_games;
analyze public.crash_bets;
analyze public.jackpot_entries;
