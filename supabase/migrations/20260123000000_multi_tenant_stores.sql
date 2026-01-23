-- 1. Create Stores table
create table if not exists public.stores (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants on delete cascade not null,
  name text not null,
  address text,
  phone text,
  created_at timestamptz default now()
);

-- 2. Create Employees table (For POS PIN login, no Dashboard access)
create table if not exists public.employees (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants on delete cascade not null, -- Denormalized for easier RLS
  store_id uuid references public.stores on delete cascade not null,
  name text not null,
  pin_code text not null, -- Typically 4-6 digits
  role text default 'staff', -- 'store_manager', 'staff' (This is their POS role)
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Update Profiles for Admin Access (Dashboard Users)
-- We need to safely update the check constraint.
do $$ 
begin
    -- Add store_id if it doesn't exist
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'store_id') then
        alter table public.profiles add column store_id uuid references public.stores on delete set null;
    end if;

    -- Drop old constraint if exists
    if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
        alter table public.profiles drop constraint profiles_role_check;
    end if;
end $$;

-- Add new constraint
alter table public.profiles add constraint profiles_role_check 
  check (role in ('super_admin', 'partner', 'store_manager'));

-- 4. Enable RLS for new tables
alter table public.stores enable row level security;
alter table public.employees enable row level security;

-- 5. RLS Policies

-- Stores:
-- Partners can see all stores in their tenant
create policy "Stores visible to tenant members" on public.stores
  for select using (tenant_id = public.get_tenant_id());

-- Employees:
-- Store Managers can see employees in their store
-- Partners can see all employees in their tenant
create policy "Employees visible to tenant members" on public.employees
  for select using (tenant_id = public.get_tenant_id());

-- 6. Link existing tables to Stores (Optional for now, but good for future)
-- Orders and Products should ideally belong to a Store, not just a Tenant, 
-- but for now we can keep them Tenant-level or add store_id later.
-- Let's add store_id to orders to separate sales by store.
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'store_id') then
        alter table public.orders add column store_id uuid references public.stores;
    end if;
end $$;
