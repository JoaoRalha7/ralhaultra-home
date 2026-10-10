-- Public feed of voucher redeems (Home > Activity Feed > Giveaways & Raffles).
-- Does NOT expose the code itself, only who redeemed, when and how many points.
create or replace function public.recent_voucher_redeems(lim int default 10)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(x), '[]'::json) from (
    select r.username, r.created_at, v.points
    from public.voucher_redemptions r
    join public.vouchers v on v.code = r.code
    order by r.created_at desc
    limit least(greatest(coalesce(lim,10),1), 50)
  ) x;
$$;
grant execute on function public.recent_voucher_redeems(int) to anon, authenticated;
