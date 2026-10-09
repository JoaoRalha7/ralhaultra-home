-- Give (or take) points to EVERYBODY WHO HAS LOGGED IN to the site (has a profile) at once; chat-only viewers are left out. Run in the MAIN project. Safe to run more than once.
-- Balances never go below 0: when taking points, someone with less than the amount simply goes to 0.
-- Returns how many balances really changed. Every change is logged in point_transactions.
create or replace function public.admin_add_points_all(p_delta bigint, p_reason text default 'admin_all')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_delta is null or p_delta = 0 then return 0; end if;
  with old as (
    select b.username, b.balance from point_balances b
     where exists (select 1 from profiles p where lower(p.twitch_username) = b.username)
  ),
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

revoke all on function public.admin_add_points_all(bigint, text) from public, anon, authenticated;
