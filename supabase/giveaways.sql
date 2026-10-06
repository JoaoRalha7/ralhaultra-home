-- Giveaways & Raffles. Run once in the Supabase SQL editor (public project).
create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prize text not null,
  kind text not null default 'giveaway' check (kind in ('giveaway','raffle')),
  image_url text,
  ends_at timestamptz not null,
  winner text,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  twitch_username text not null,
  created_at timestamptz not null default now(),
  unique (giveaway_id, user_id)
);

alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;

drop policy if exists "giveaways read" on public.giveaways;
create policy "giveaways read" on public.giveaways for select using (true);
drop policy if exists "giveaways admin write" on public.giveaways;
create policy "giveaways admin write" on public.giveaways for all
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd')
  with check (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

drop policy if exists "entries read" on public.giveaway_entries;
create policy "entries read" on public.giveaway_entries for select using (true);
drop policy if exists "entries insert own" on public.giveaway_entries;
create policy "entries insert own" on public.giveaway_entries for insert
  with check (auth.uid() = user_id
    and exists (select 1 from public.giveaways g where g.id = giveaway_id and g.status = 'active' and g.ends_at > now()));
drop policy if exists "entries admin delete" on public.giveaway_entries;
create policy "entries admin delete" on public.giveaway_entries for delete
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

-- v2: points-based tickets (safe to run again)
alter table public.giveaways add column if not exists description text;
alter table public.giveaways add column if not exists ticket_cost integer not null default 0;
alter table public.giveaways add column if not exists max_tickets integer; -- null = unlimited
alter table public.giveaway_entries add column if not exists tickets integer not null default 1 check (tickets > 0);
alter table public.giveaway_entries add column if not exists cost_paid integer not null default 0;
alter table public.giveaway_entries drop constraint if exists giveaway_entries_giveaway_id_user_id_key;

-- refresh the API schema cache so new columns are visible
notify pgrst, 'reload schema';

-- v3: entries are now created only by the worker (service key), which charges the points.
-- Run this together with the new worker deploy. Without it, anyone could insert entries directly.
drop policy if exists "entries insert own" on public.giveaway_entries;
