-- Run in Supabase SQL Editor if your project was created before office_locations existed.

create table if not exists public.office_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null default '',
  country text not null default '',
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  radius integer not null default 100,
  working_hours jsonb not null default '{"start":"09:00","end":"17:00"}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists trg_office_locations_updated_at on public.office_locations;
create trigger trg_office_locations_updated_at before update on public.office_locations
for each row execute function public.set_updated_at();

alter table public.office_locations enable row level security;

drop policy if exists "office_locations_read_authenticated" on public.office_locations;
create policy "office_locations_read_authenticated" on public.office_locations
for select using (auth.uid() is not null);

drop policy if exists "office_locations_manager_admin_write" on public.office_locations;
create policy "office_locations_manager_admin_write" on public.office_locations
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
