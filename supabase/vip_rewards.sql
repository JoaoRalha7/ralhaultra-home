-- Level-up rewards (one-time per rank) + daily boost per rank.
alter table public.vip_levels add column if not exists levelup_reward bigint not null default 0;
alter table public.vip_levels add column if not exists daily_boost_pct integer not null default 0;

update public.vip_levels set levelup_reward = 0,       daily_boost_pct = 0  where level = 0;
update public.vip_levels set levelup_reward = 10000,   daily_boost_pct = 5  where level = 1;
update public.vip_levels set levelup_reward = 25000,   daily_boost_pct = 10 where level = 2;
update public.vip_levels set levelup_reward = 75000,   daily_boost_pct = 15 where level = 3;
update public.vip_levels set levelup_reward = 200000,  daily_boost_pct = 20 where level = 4;
update public.vip_levels set levelup_reward = 500000,  daily_boost_pct = 25 where level = 5;

create table if not exists public.vip_level_claims (
  username   text not null check (username = lower(username)),
  level      integer not null,
  amount     bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (username, level)
);
alter table public.vip_level_claims enable row level security; -- no policies: only the Worker (service key) reads/writes

-- Atomic: the primary key makes a second claim impossible.
create or replace function public.claim_levelup(p_user text, p_level integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare u text := lower(p_user); cur integer; amt bigint;
begin
  select level into cur from point_balances where username = u;
  if cur is null or p_level < 1 or p_level > cur then raise exception 'not_reached'; end if;
  select levelup_reward into amt from vip_levels where level = p_level;
  if coalesce(amt, 0) <= 0 then raise exception 'no_reward'; end if;
  begin
    insert into vip_level_claims (username, level, amount) values (u, p_level, amt);
  exception when unique_violation then raise exception 'already_claimed';
  end;
  return add_points(u, amt, 'vip_levelup', 'level:' || p_level);
end $$;
revoke all on function public.claim_levelup(text, integer) from public, anon, authenticated;
