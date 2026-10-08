-- Cutover helpers. Run in order, exactly when the steps say so.

-- STEP A (before re-importing): wipe the test balances.
-- truncate public.point_transactions, public.se_import, public.point_balances;

-- STEP B (right after the x20 import): cap everybody at 500,000 so nobody starts with a shop prize.
update public.point_balances set balance = 500000 where balance > 500000;

-- STEP C (check): top 10 and totals.
select username, balance from public.point_balances order by balance desc limit 10;
select count(*) as users, sum(balance) as total from public.point_balances;
