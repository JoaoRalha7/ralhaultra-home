-- Run in the DASHBOARD Supabase project (the one with bonus_hunts / pick_games). Makes the site update instantly.
do $$
declare t text;
begin
  foreach t in array array['bonus_hunts','bonus_entries','pick_games','gtb_games','avg_multi_games','tournaments','picks','gtb_entries','avg_multi_entries'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1;
