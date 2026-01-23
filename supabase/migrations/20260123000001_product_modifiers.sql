-- 1. Modifier Groups (e.g., Sugar Level, Ice Level)
create table if not exists public.modifier_groups (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- 2. Modifier Options (e.g., Half Sugar, No Ice)
create table if not exists public.modifier_options (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.modifier_groups on delete cascade not null,
  name text not null,
  extra_price numeric(10,2) default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 3. Junction Table: Product <-> Modifier Group
create table if not exists public.product_modifier_groups (
  product_id uuid references public.products on delete cascade not null,
  modifier_group_id uuid references public.modifier_groups on delete cascade not null,
  primary key (product_id, modifier_group_id)
);

-- 4. Enable RLS
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;

-- 5. Policies (Consistent with current demo setup: Public read)
create policy "Modifier groups visible to everyone" on public.modifier_groups for select using (true);
create policy "Modifier options visible to everyone" on public.modifier_options for select using (true);
create policy "Product modifier groups visible to everyone" on public.product_modifier_groups for select using (true);
create policy "Modifier groups admin access" on public.modifier_groups for all using (tenant_id = public.get_tenant_id());
