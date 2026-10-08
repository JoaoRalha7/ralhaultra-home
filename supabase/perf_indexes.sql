-- Speeds up the VIP page, the profile and the player card: they look bets up by username, which had no index
-- (every open scanned the whole casino_games / crash_bets table). Run in the MAIN project. Safe to run more than once.
create index if not exists casino_games_user_time on public.casino_games (username, created_at desc);
create index if not exists casino_games_user_lower on public.casino_games (lower(username));
create index if not exists crash_bets_user_name on public.crash_bets (username, created_at desc);
create index if not exists crash_bets_user_lower on public.crash_bets (lower(username));
analyze public.casino_games;
analyze public.crash_bets;
