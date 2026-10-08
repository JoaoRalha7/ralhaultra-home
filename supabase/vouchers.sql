-- Voucher codes: the streamer creates codes, viewers redeem them on /profile. Run once.
create table if not exists public.vouchers (
  code        text primary key,               -- stored UPPERCASE
  points      bigint not null check (points > 0),
  max_uses    integer not null default 1,
  uses        integer not null default 0,
  expires_at  timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.voucher_redemptions (
  code        text not null references public.vouchers(code) on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now(),
  primary key (code, username)
);
alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;

-- Atomic: validates, marks the use and pays. Returns points paid, or raises one of:
-- invalid_code, expired, used_up, already_redeemed.
create or replace function public.redeem_voucher(p_user text, p_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  u text := lower(p_user);
  c text := upper(trim(p_code));
  v vouchers%rowtype;
begin
  select * into v from vouchers where code = c and active for update;
  if not found then raise exception 'invalid_code'; end if;
  if v.expires_at is not null and v.expires_at < now() then raise exception 'expired'; end if;
  if v.uses >= v.max_uses then raise exception 'used_up'; end if;
  begin
    insert into voucher_redemptions (code, username) values (c, u);
  exception when unique_violation then
    raise exception 'already_redeemed';
  end;
  update vouchers set uses = uses + 1 where code = c;
  perform add_points(u, v.points, 'voucher:' || c);
  return v.points;
end;
$$;
revoke all on function public.redeem_voucher(text, text) from public, anon, authenticated;

-- Example (create a code):  insert into vouchers (code, points, max_uses) values ('WELCOME', 2000, 100);
