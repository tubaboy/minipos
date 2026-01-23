alter table public.order_items 
add column if not exists modifiers jsonb default '[]'::jsonb;
