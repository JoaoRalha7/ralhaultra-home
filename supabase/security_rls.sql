-- Closes tables that were exposed (RLS off). Safe to run more than once.
-- Reads stay public where the site needs them; writes are admin only (the streamer). The Worker uses the
-- service key, which bypasses RLS, so redeems, stock and points keep working.

-- Shop
alter table public.shop_products enable row level security;
drop policy if exists "shop_products read" on public.shop_products;
create policy "shop_products read" on public.shop_products for select using (true);
drop policy if exists "shop_products admin" on public.shop_products;
create policy "shop_products admin" on public.shop_products for all
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd')
  with check (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

alter table public.shop_redeems enable row level security;
drop policy if exists "shop_redeems read" on public.shop_redeems;
create policy "shop_redeems read" on public.shop_redeems for select using (true);   -- recent redeems feed
drop policy if exists "shop_redeems admin" on public.shop_redeems;
create policy "shop_redeems admin" on public.shop_redeems for all
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd')
  with check (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

-- Promo banners and presets
alter table public.promo_banners enable row level security;
drop policy if exists "promo_banners read" on public.promo_banners;
create policy "promo_banners read" on public.promo_banners for select using (true);
drop policy if exists "promo_banners admin" on public.promo_banners;
create policy "promo_banners admin" on public.promo_banners for all
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd')
  with check (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

alter table public.promo_preset_banners enable row level security;
drop policy if exists "promo_preset_banners read" on public.promo_preset_banners;
create policy "promo_preset_banners read" on public.promo_preset_banners for select using (true);
drop policy if exists "promo_preset_banners admin" on public.promo_preset_banners;
create policy "promo_preset_banners admin" on public.promo_preset_banners for all
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd')
  with check (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

alter table public.promo_presets enable row level security;
drop policy if exists "promo_presets read" on public.promo_presets;
create policy "promo_presets read" on public.promo_presets for select using (true);
drop policy if exists "promo_presets admin" on public.promo_presets;
create policy "promo_presets admin" on public.promo_presets for all
  using (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd')
  with check (auth.uid() = '13878854-d588-4c49-ad36-1428920902bd');

notify pgrst, 'reload schema';
