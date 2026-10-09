-- Welcome popup: shown once, the first time someone logs in to the site. Run in the MAIN project. Safe to run more than once.
-- Everybody who already exists counts as welcomed (default true while the column is added); rows created from now on start as not welcomed.
alter table public.point_balances add column if not exists welcomed boolean not null default true;
alter table public.point_balances alter column welcomed set default false;
