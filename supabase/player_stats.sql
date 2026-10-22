-- Exact per-game stats for the player profile (the profile only read the first 1000 bets before).
-- Run in the MAIN project BEFORE deploying the worker. Safe to run more than once.
create or replace function public.player_stats(p_user text)
returns table (game text, bets bigint, wagered bigint, wins bigint, losses bigint, best_win bigint, best_mult numeric, profit bigint)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select g.game, g.bet::bigint as b, g.payout::bigint as p
      from casino_games g where g.username = lower(p_user) and g.status = 'done'
    union all
    select 'crash', c.bet::bigint, case when c.cashed_at is not null then floor(c.bet * c.cashed_at)::bigint else 0 end
      from crash_bets c where c.username = lower(p_user)
  )
  select game,
         count(*)::bigint,
         coalesce(sum(b), 0)::bigint,
         count(*) filter (where p > b)::bigint,
         count(*) filter (where not (p > b))::bigint,
         greatest(coalesce(max(p - b), 0), 0)::bigint,
         coalesce(max(p::numeric / nullif(b, 0)), 0),
         coalesce(sum(p - b), 0)::bigint
    from t
   group by game
$$;
revoke all on function public.player_stats(text) from public, anon, authenticated;
