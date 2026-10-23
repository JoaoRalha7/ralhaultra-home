-- Corre no projeto Supabase do DASHBOARD (o que tem giveaway_state)
alter table public.giveaway_state
  add column if not exists prize text,
  add column if not exists prize_image text,
  add column if not exists reply_secs integer;
