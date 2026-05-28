-- Run in Supabase SQL Editor if leave_balances is missing from your project.

create table if not exists public.leave_balances (
  id text primary key,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  annual integer not null default 20,
  sick integer not null default 10,
  personal integer not null default 5,
  maternity integer not null default 90,
  paternity integer not null default 10,
  bereavement integer not null default 5,
  unpaid integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (employee_id, year)
);

drop trigger if exists trg_leave_balances_updated_at on public.leave_balances;
create trigger trg_leave_balances_updated_at before update on public.leave_balances
for each row execute function public.set_updated_at();

alter table public.leave_balances enable row level security;

drop policy if exists "leave_balances_owner_read" on public.leave_balances;
create policy "leave_balances_owner_read" on public.leave_balances
for select using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "leave_balances_owner_write" on public.leave_balances;
create policy "leave_balances_owner_write" on public.leave_balances
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
);
