-- Admins table: the owner is hardcoded (cannot be removed); extra admins can edit casinos + deposit methods.
create table if not exists public.admins (
  user_id uuid primary key,
  username text,
  added_at timestamptz default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = '13878854-d588-4c49-ad36-1428920902bd'::uuid
      or exists (select 1 from public.admins where user_id = auth.uid());
$$;
create or replace function public.is_owner() returns boolean
language sql stable as $$ select auth.uid() = '13878854-d588-4c49-ad36-1428920902bd'::uuid $$;

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select using (public.is_admin());
drop policy if exists admins_owner_write on public.admins;
create policy admins_owner_write on public.admins for all using (public.is_owner()) with check (public.is_owner());

-- extra admins may manage casinos + deposit methods (additive to existing policies)
drop policy if exists casinos_admins on public.casinos;
create policy casinos_admins on public.casinos for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists methods_admins on public.deposit_methods;
create policy methods_admins on public.deposit_methods for all using (public.is_admin()) with check (public.is_admin());

-- Owner-only: add an admin by Twitch username (looks in profiles and auth.users, bypasses RLS)
create or replace function public.add_admin(p_username text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid; v_name text; n text := lower(trim(both '@' from trim(p_username)));
begin
  if not public.is_owner() then return jsonb_build_object('ok', false, 'error', 'owner only'); end if;
  select id, twitch_username into v_id, v_name from public.profiles where lower(twitch_username) = n limit 1;
  if v_id is null then
    select id, coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'preferred_username', raw_user_meta_data->>'user_name')
      into v_id, v_name from auth.users
     where lower(coalesce(raw_user_meta_data->>'name','')) = n
        or lower(coalesce(raw_user_meta_data->>'preferred_username','')) = n
        or lower(coalesce(raw_user_meta_data->>'user_name','')) = n
        or lower(coalesce(raw_user_meta_data->>'full_name','')) = n limit 1;
  end if;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'not found'); end if;
  insert into public.admins(user_id, username) values (v_id, v_name) on conflict (user_id) do update set username = excluded.username;
  return jsonb_build_object('ok', true, 'username', v_name);
end $$;
revoke all on function public.add_admin(text) from public;
grant execute on function public.add_admin(text) to authenticated;
