-- 1. POS Devices Table
create table if not exists public.pos_devices (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  store_id uuid references public.stores(id) on delete cascade not null,
  device_token text unique not null, -- Long random string
  device_name text, -- e.g. "Counter iPad"
  role text default 'pos' check (role in ('pos', 'kitchen')),
  last_active_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. Pairing Codes Table (Short lived)
create table if not exists public.pairing_codes (
  code text primary key, -- The 6-digit code
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  store_id uuid references public.stores(id) on delete cascade not null,
  role text default 'pos' check (role in ('pos', 'kitchen')),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id)
);

-- 3. Enable RLS
alter table public.pos_devices enable row level security;
alter table public.pairing_codes enable row level security;

-- 4. RLS Policies

-- pos_devices: 
-- Partners/Admins can see all devices in their tenant
create policy "Devices visible to tenant admins" on public.pos_devices
  for select using (tenant_id = public.get_tenant_id());

create policy "Devices deletable by tenant admins" on public.pos_devices
  for delete using (tenant_id = public.get_tenant_id());

-- pairing_codes:
-- Admins can create and view codes
create policy "Codes visible to tenant admins" on public.pairing_codes
  for all using (tenant_id = public.get_tenant_id());

-- 5. Functions

-- Generate Pairing Code
create or replace function generate_pairing_code(p_store_id uuid, p_role text)
returns text
language plpgsql security definer
as $$
declare
  v_tenant_id uuid;
  v_code text;
  v_exists boolean;
begin
  -- Check permissions (must be admin/manager of this tenant)
  select tenant_id into v_tenant_id
  from public.stores
  where id = p_store_id;
  
  -- Simple check: does the current user belong to this tenant?
  -- (RLS usually handles this, but we are security definer)
  if v_tenant_id != public.get_tenant_id() then
    raise exception 'Unauthorized';
  end if;

  -- Generate unique 6-digit code
  loop
    v_code := floor(random() * 900000 + 100000)::text;
    select exists(select 1 from public.pairing_codes where code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  insert into public.pairing_codes (code, tenant_id, store_id, role, expires_at, created_by)
  values (v_code, v_tenant_id, p_store_id, p_role, now() + interval '10 minutes', auth.uid());

  return v_code;
end;
$$;

-- Verify Pairing Code (Called by POS - Public Access)
create or replace function verify_pairing_code(p_code text, p_device_name text)
returns json
language plpgsql security definer
as $$
declare
  v_pairing_record record;
  v_device_token text;
  v_store_name text;
  v_tenant_mode text;
begin
  -- 1. Find valid code
  select * into v_pairing_record
  from public.pairing_codes
  where code = p_code and expires_at > now();

  if not found then
    raise exception '無效或已過期的配對碼';
  end if;

  -- 2. Get Store Info
  select name into v_store_name from public.stores where id = v_pairing_record.store_id;
  select mode into v_tenant_mode from public.tenants where id = v_pairing_record.tenant_id;

  -- 3. Generate Device Token (UUID)
  v_device_token := gen_random_uuid()::text;

  -- 4. Create Device Record
  insert into public.pos_devices (
    tenant_id, store_id, device_token, device_name, role
  ) values (
    v_pairing_record.tenant_id,
    v_pairing_record.store_id,
    v_device_token,
    p_device_name,
    v_pairing_record.role
  );

  -- 5. Delete used code
  delete from public.pairing_codes where code = p_code;

  -- 6. Return Data
  return json_build_object(
    'device_token', v_device_token,
    'store_id', v_pairing_record.store_id,
    'store_name', v_store_name,
    'role', v_pairing_record.role,
    'tenant_mode', v_tenant_mode
  );
end;
$$;

-- Get Device Session (Called by POS on load)
create or replace function get_device_session(p_device_token text)
returns json
language plpgsql security definer
as $$
declare
  v_device record;
  v_store_name text;
  v_tenant_mode text;
begin
  update public.pos_devices set last_active_at = now() where device_token = p_device_token
  returning * into v_device;

  if not found then
    raise exception 'Invalid Token';
  end if;

  select name into v_store_name from public.stores where id = v_device.store_id;
  select mode into v_tenant_mode from public.tenants where id = v_device.tenant_id;

  return json_build_object(
    'store_id', v_device.store_id,
    'store_name', v_store_name,
    'role', v_device.role,
    'tenant_mode', v_tenant_mode
  );
end;
$$;

-- Revoke Device (Called by Admin)
create or replace function revoke_device(p_device_id uuid)
returns void
language plpgsql security definer
as $$
begin
  -- Check permission: device must belong to user's tenant
  delete from public.pos_devices
  where id = p_device_id
  and tenant_id = public.get_tenant_id();
end;
$$;
