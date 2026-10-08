-- Shop products can require a minimum VIP level (0 = everybody). Run in the MAIN project. Safe to run more than once.
alter table public.shop_products add column if not exists min_vip_level integer not null default 0;
