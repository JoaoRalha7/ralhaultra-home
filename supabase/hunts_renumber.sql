-- Renumber all bonus hunts #1..#N (oldest first). Run in the DASHBOARD Supabase project.
-- Step 1: preview (old title -> new title). Check it looks right.
select id, date, title as old_title,
       'Bonus Hunt #' || row_number() over (order by date nulls first, id) as new_title
from public.bonus_hunts
order by date nulls first, id;

-- Step 2: apply (select this block and run it)
with n as (
  select id, row_number() over (order by date nulls first, id) as rn
  from public.bonus_hunts
)
update public.bonus_hunts h
set title = 'Bonus Hunt #' || n.rn
from n
where h.id = n.id;
