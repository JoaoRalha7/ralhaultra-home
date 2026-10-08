-- Run in the MAIN Supabase project. Lets the site read Twitch pictures of other players (profiles is RLS-protected).
create or replace function public.get_avatars(p_names text[])
returns table(twitch_username text, avatar_url text)
language sql security definer set search_path = public as $$
  select lower(twitch_username), avatar_url from profiles
  where lower(twitch_username) = any (select lower(n) from unnest(p_names) n) and avatar_url is not null
  limit 300;
$$;
grant execute on function public.get_avatars(text[]) to anon, authenticated;
