-- Create tenants table
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

-- Create profiles table (User details)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  tenant_id uuid references public.tenants on delete cascade not null,
  role text check (role in ('admin', 'manager', 'counter', 'kitchen')) not null,
  name text not null,
  employee_id text,
  created_at timestamptz default now()
);

-- Helper function to get current user's tenant_id
create or replace function public.get_tenant_id()
returns uuid
language sql security definer
stable
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- Categories
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants not null,
  name text not null,
  parent_id uuid references public.categories,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Products
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants not null,
  category_id uuid references public.categories,
  name text not null,
  price numeric(10,2) not null default 0,
  is_available boolean default true,
  image_url text,
  created_at timestamptz default now()
);

-- Orders
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants not null,
  order_number text not null,
  status text check (status in ('pending', 'processing', 'completed', 'closed')) default 'pending',
  type text check (type in ('dine_in', 'take_out')) not null,
  table_number text,
  total_amount numeric(10,2) default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Order Items
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants not null,
  order_id uuid references public.orders on delete cascade not null,
  product_id uuid references public.products,
  product_name text not null,
  quantity int not null default 1,
  price numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

-- Daily Sequence for Order Numbers
create table if not exists public.daily_order_sequences (
  tenant_id uuid references public.tenants,
  date date default current_date,
  sequence int default 0,
  primary key (tenant_id, date)
);

create or replace function generate_order_number(p_tenant_id uuid)
returns text
language plpgsql
as $$
declare
  v_seq int;
  v_date date := current_date;
  v_order_number text;
begin
  insert into daily_order_sequences (tenant_id, date, sequence)
  values (p_tenant_id, v_date, 1)
  on conflict (tenant_id, date)
  do update set sequence = daily_order_sequences.sequence + 1
  returning sequence into v_seq;
  
  v_order_number := to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
  return v_order_number;
end;
$$;

-- Enable RLS
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Policies
create policy "Tenants readable by members" on tenants
  for select using (id = get_tenant_id());

create policy "Profiles readable by members" on profiles
  for select using (tenant_id = get_tenant_id());
  
create policy "Profiles readable by self" on profiles
  for select using (id = auth.uid());

create policy "Categories access" on categories
  for all using (tenant_id = get_tenant_id());

create policy "Products access" on products
  for all using (tenant_id = get_tenant_id());

create policy "Orders access" on orders
  for all using (tenant_id = get_tenant_id());

create policy "Order items access" on order_items
  for all using (tenant_id = get_tenant_id());

-- Realtime
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
