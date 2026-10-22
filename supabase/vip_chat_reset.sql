-- Everybody's chat message counter back to 0, then levels are recomputed.
-- Careful: from now on a level needs its messages, so people drop to the level their messages allow (Member until they chat).
-- Run in the MAIN project, once.
update public.point_balances set chat_messages = 0 where chat_messages <> 0;
select public.refresh_vip();
