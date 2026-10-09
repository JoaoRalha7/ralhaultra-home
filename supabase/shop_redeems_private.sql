-- Close public read of shop_redeems (it exposes admin_notes and every column).
-- The public feeds (Home activity + Shop "recent redeems") read through this safe function instead.
create or replace function public.recent_shop_redeems(lim int default 10)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(x), '[]'::json) from (
    select r.id, r.twitch_username, r.created_at, r.cost_at_redeem, r.status,
           json_build_object('name', p.name, 'image_url', p.image_url) as shop_products
    from public.shop_redeems r
    left join public.shop_products p on p.id = r.product_id
    order by r.created_at desc
    limit least(greatest(coalesce(lim,10),1), 50)
  ) x;
$$;
grant execute on function public.recent_shop_redeems(int) to anon, authenticated;

drop policy if exists "shop_redeems read" on public.shop_redeems;
-- the admin policy ("shop_redeems admin", ALL) stays; the worker uses the service key.
