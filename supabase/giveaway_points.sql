-- Giveaways with a points prize: the winner is paid automatically when you draw. Run in the MAIN project. Safe to run more than once.
alter table public.giveaways add column if not exists prize_points bigint not null default 0;
alter table public.giveaways add column if not exists paid boolean not null default false;
