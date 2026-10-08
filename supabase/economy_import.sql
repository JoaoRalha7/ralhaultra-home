-- StreamElements import. Run AFTER economy.sql. Safe to run more than once.
-- Idempotent on purpose: you can import now, and again right before the cutover.
-- Each run only applies the DIFFERENCE since the last import, so points the bot gave
-- in the meantime (watchtime) are never overwritten.

create table if not exists public.se_import (
  username     text primary key,
  points       bigint not null,          -- last SE balance applied (already multiplied)
  imported_at  timestamptz not null default now()
);
alter table public.se_import enable row level security;

-- p_rows: [{ "username": "x", "points": 1234 }, ...]  p_mult: scale factor old -> new economy
create or replace function public.import_se_balances(p_rows jsonb, p_mult numeric default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     jsonb;
  u     text;
  newp  bigint;
  prev  bigint;
  delta bigint;
  bal   bigint;
  n     integer := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    u := lower(r->>'username');
    if u is null or u = '' then continue; end if;
    newp := round(coalesce((r->>'points')::numeric, 0) * p_mult)::bigint;

    select points into prev from se_import where username = u;
    delta := newp - coalesce(prev, 0);

    insert into point_balances (username) values (u) on conflict (username) do nothing;

    update point_balances
       set balance = greatest(balance + delta, 0), updated_at = now()
     where username = u
    returning balance into bal;

    if delta <> 0 then
      insert into point_transactions (username, delta, balance_after, reason)
      values (u, delta, bal, 'se_import');
    end if;

    insert into se_import (username, points) values (u, newp)
    on conflict (username) do update set points = excluded.points, imported_at = now();

    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.import_se_balances(jsonb, numeric) from public, anon, authenticated;
