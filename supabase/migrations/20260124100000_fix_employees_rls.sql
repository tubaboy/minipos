drop policy if exists "Employees visible to tenant members" on public.employees;

create policy "Employees managed by tenant members" on public.employees
  for all
  using (tenant_id = public.get_tenant_id())
  with check (tenant_id = public.get_tenant_id());