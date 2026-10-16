-- Speeds up the casino feed, the biggest-wins list and the points leaderboard (they were the slowest queries).
-- Run in the MAIN project. Safe to run more than once.
create index if not exists casino_games_done_recent on public.casino_games (updated_at desc) where status = 'done';
create index if not exists casino_games_done_payout on public.casino_games (payout desc) where status = 'done' and payout > 0;
create index if not exists point_balances_top2 on public.point_balances (balance desc, username asc);
analyze public.casino_games;
analyze public.point_balances;
