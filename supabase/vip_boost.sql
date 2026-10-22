-- Better VIP: bigger watch bonus per level and more chat messages per level.
-- Run in the MAIN project, after vip_chat.sql. Safe to run more than once (it just sets these numbers).

-- Extra watch multiplier per level (added to the sub multiplier and the session bonus)
update public.vip_levels set bonus_mult = 0    where level = 0;
update public.vip_levels set bonus_mult = 0.15 where level = 1;
update public.vip_levels set bonus_mult = 0.30 where level = 2;
update public.vip_levels set bonus_mult = 0.50 where level = 3;
update public.vip_levels set bonus_mult = 0.75 where level = 4;
update public.vip_levels set bonus_mult = 1.00 where level = 5;

-- Chat messages per level: about one message every 4 minutes of the hours each level asks for
update public.vip_levels set min_chat_messages = 0    where level = 0;
update public.vip_levels set min_chat_messages = 150  where level = 1;
update public.vip_levels set min_chat_messages = 500  where level = 2;
update public.vip_levels set min_chat_messages = 1200 where level = 3;
update public.vip_levels set min_chat_messages = 2500 where level = 4;
update public.vip_levels set min_chat_messages = 5000 where level = 5;

-- Room for sub + level + session bonus to add up
update public.economy_config set value = '3.5' where key = 'mult_cap';

select level, name, min_wagered, min_watch_hours, min_chat_messages, bonus_mult from public.vip_levels order by level;
