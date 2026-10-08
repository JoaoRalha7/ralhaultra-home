-- StreamElements watchtime import. Run in the MAIN project, after economy.sql / economy_import.sql.
-- Idempotent: each run only applies the DIFFERENCE since the last import, so minutes the bot
-- counted in the meantime are never overwritten.

create table if not exists public.se_import_watch (
  username     text primary key,
  minutes      bigint not null,
  imported_at  timestamptz not null default now()
);
alter table public.se_import_watch enable row level security;

-- p_rows: [{ "username": "x", "minutes": 1234 }, ...]
create or replace function public.import_se_watchtime(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     jsonb;
  u     text;
  newm  bigint;
  prev  bigint;
  delta bigint;
  n     integer := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    u := lower(r->>'username');
    if u is null or u = '' then continue; end if;
    newm := greatest(coalesce((r->>'minutes')::numeric, 0), 0)::bigint;

    select minutes into prev from se_import_watch where username = u;
    delta := newm - coalesce(prev, 0);

    insert into point_balances (username) values (u) on conflict (username) do nothing;

    update point_balances
       set watch_minutes = greatest(watch_minutes + delta, 0), updated_at = now()
     where username = u;

    insert into se_import_watch (username, minutes) values (u, newm)
    on conflict (username) do update set minutes = excluded.minutes, imported_at = now();

    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.import_se_watchtime(jsonb) from public, anon, authenticated;
