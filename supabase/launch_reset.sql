-- LAUNCH RESET. Run the SAME file in BOTH Supabase projects (main zyzjvbpveriwsxhpheoh, then dash vsqxaxaxdvvwrvjookbm).
-- Every table it wipes is copied first into schema backup_launch (not exposed by the API), so nothing is lost.
-- Missing tables are skipped. Runs as ONE transaction: if anything fails, nothing changes.
-- Kept untouched: casinos, slots, shop_products, vip_levels, vouchers, giveaways, bot_*, admins, economy_config, casino_seeds, se_import*.

create schema if not exists backup_launch;

do $$
declare
  t text;
  wipe text[] := array[
    -- points, VIP, casino originals (main project)
    'point_transactions','points_ledger','casino_games','crash_bets','crash_rounds','jackpot_entries','jackpot_rounds',
    'mines_games','vip_level_claims','voucher_redemptions','shop_redeems','daily_redeems',
    -- mini-games, hunts, tournaments (children first)
    'minigame_sessions','minigame_ranking','picks','pick_games','gtb_entries','gtb_games','avg_multi_entries','avg_multi_games',
    'bonus_entries','bonus_hunts','tournaments','slot_stats'
  ];
begin
  foreach t in array wipe loop
    if to_regclass('public.' || t) is not null
       and (select c.relkind from pg_class c where c.oid = to_regclass('public.' || t)) = 'r' then
      execute format('create table if not exists backup_launch.%I as table public.%I', t, t);
      execute format('delete from public.%I', t);
      raise notice 'wiped %', t;
    end if;
  end loop;

  -- only the main project has point_balances
  if to_regclass('public.point_balances') is not null then
    create table if not exists backup_launch.point_balances as table public.point_balances;
    create table if not exists backup_launch.profiles as table public.profiles;
    create table if not exists backup_launch.auth_users_created as select id, created_at from auth.users;

    update public.point_balances
       set balance = 50000, watch_minutes = 0, wagered_total = 0, level = 0, created_at = now(), updated_at = now();
    begin update public.point_balances set vip_watch_base = 0; exception when undefined_column then null; end;

    insert into public.point_transactions (username, delta, balance_after, reason)
    select username, 50000, 50000, 'admin:Launch bonus' from public.point_balances;

    -- daily reward + streak back to zero, "joined" = today
    begin update public.profiles set last_daily_claim = null, streak_count = 0, streak_last_day = null; exception when undefined_column then null; end;
    begin update public.profiles set created_at = now(); exception when undefined_column then null; end;
    update auth.users set created_at = now();

    -- voucher codes become usable again
    begin update public.vouchers set uses = 0; exception when undefined_table or undefined_column then null; end;

    -- log everybody out
    delete from auth.refresh_tokens;
    delete from auth.sessions;
  end if;
end $$;
