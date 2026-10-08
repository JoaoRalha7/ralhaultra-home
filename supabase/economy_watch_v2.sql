-- watch_tick v2: the bot sends WHO is watching (sub tier + eligible), the DB decides how many points.
-- Multiplier = min(mult_cap, sub multiplier + VIP bonus). Run AFTER economy.sql and economy_vip.sql.
-- Still accepts the old format ({"points": N}) so the running bot keeps working until it is redeployed.
-- p_rows: [{ "username": "x", "twitch_id": "123", "sub_tier": 0..3, "eligible": true }, ...]
create or replace function public.watch_tick(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     jsonb;
  n     integer := 0;
  u     text;
  pts   bigint;
  bal   bigint;
  vb    numeric;
  m     numeric;
  base  numeric := coalesce((select (value #>> '{}')::numeric from economy_config where key = 'watch_points_per_hour'), 6000) / 60;
  cap   numeric := coalesce((select (value #>> '{}')::numeric from economy_config where key = 'mult_cap'), 2.5);
  sm    jsonb   := coalesce((select value from economy_config where key = 'sub_mult'), '{"0":1}'::jsonb);
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    u := lower(r->>'username');
    if u is null or u = '' then continue; end if;

    insert into point_balances (username, twitch_id) values (u, r->>'twitch_id')
    on conflict (username) do nothing;

    if r ? 'points' then
      pts := coalesce((r->>'points')::bigint, 0);
    else
      vb := 0;
      select coalesce(l.bonus_mult, 0) into vb
        from point_balances b join vip_levels l on l.level = b.level where b.username = u;
      m := least(cap, coalesce((sm ->> coalesce(r->>'sub_tier', '0'))::numeric, 1) + coalesce(vb, 0));
      pts := case when coalesce((r->>'eligible')::boolean, true) then round(base * m)::bigint else 0 end;
    end if;

    update point_balances
       set balance       = balance + pts,
           watch_minutes = watch_minutes + 1,
           twitch_id     = coalesce(twitch_id, r->>'twitch_id'),
           updated_at    = now()
     where username = u
    returning balance into bal;

    if pts <> 0 then
      insert into point_transactions (username, delta, balance_after, reason) values (u, pts, bal, 'watchtime');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.watch_tick(jsonb) from public, anon, authenticated;
