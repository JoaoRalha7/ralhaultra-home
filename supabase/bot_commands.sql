-- Custom chat commands + timers for the bot, edited in the dashboard (tab "Bot"). Run in the MAIN project. Safe to run more than once.
-- The bot reads these with the service key; the dashboard (admins only) edits them.

create table if not exists public.bot_commands (
  id               bigint generated always as identity primary key,
  name             text not null unique,            -- without "!", lowercase
  response         text not null,                   -- placeholders: {user} {touser} {args}
  enabled          boolean not null default true,
  global_cooldown  integer not null default 5,      -- seconds
  user_cooldown    integer not null default 15,     -- seconds
  access           text not null default 'everyone' check (access in ('everyone','sub','vip','mod','broadcaster')),
  created_at       timestamptz not null default now()
);

create table if not exists public.bot_timers (
  id                bigint generated always as identity primary key,
  name              text not null,
  message           text not null,
  enabled           boolean not null default true,
  interval_online   integer not null default 10,    -- minutes while live (0 = off)
  interval_offline  integer not null default 0,     -- minutes while offline (0 = off)
  min_lines         integer not null default 5,     -- chat lines needed since its last post
  created_at        timestamptz not null default now()
);

alter table public.bot_commands enable row level security;
alter table public.bot_timers   enable row level security;
drop policy if exists bot_commands_admin on public.bot_commands;
create policy bot_commands_admin on public.bot_commands for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists bot_timers_admin on public.bot_timers;
create policy bot_timers_admin on public.bot_timers for all using (public.is_admin()) with check (public.is_admin());

-- Give (or take) points only to the people in the list (used by !addpoints all in chat = who is in the chat right now).
-- Balances never go below 0. Returns how many balances really changed. Logged in point_transactions.
create or replace function public.admin_add_points_users(p_users text[], p_delta bigint, p_reason text default 'admin_all')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_delta is null or p_delta = 0 or p_users is null then return 0; end if;
  insert into point_balances (username)
  select distinct lower(x) from unnest(p_users) x where x is not null and x <> ''
  on conflict (username) do nothing;
  with old as (select username, balance from point_balances where username = any (select lower(x) from unnest(p_users) x)),
  upd as (
    update point_balances b
       set balance = greatest(old.balance + p_delta, 0), updated_at = now()
      from old
     where b.username = old.username and greatest(old.balance + p_delta, 0) <> old.balance
    returning b.username, b.balance as bal, (greatest(old.balance + p_delta, 0) - old.balance) as applied
  ),
  ins as (
    insert into point_transactions (username, delta, balance_after, reason)
    select username, applied, bal, p_reason from upd
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$$;
revoke all on function public.admin_add_points_users(text[], bigint, text) from public, anon, authenticated;

-- Starting data (only if the tables are empty)
insert into public.bot_timers (name, message, interval_online, interval_offline, min_lines)
select 'Site - Ralha.pt', 'TODAS AS OFERTAS EM -> jralha.com', 7, 30, 5
where not exists (select 1 from public.bot_timers);
insert into public.bot_commands (name, response, global_cooldown, user_cooldown)
select 'loja', 'Loja de pontos -> https://jralha.com/shop', 5, 15
where not exists (select 1 from public.bot_commands);
