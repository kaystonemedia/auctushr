-- Run in Supabase SQL Editor for productivity analytics (focus sessions + meetings).

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  duration numeric(10,2) not null default 0,
  completed boolean not null default false,
  interruptions integer not null default 0,
  status text not null default 'active',
  productivity_score numeric(8,2),
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_focus_sessions_user_start on public.focus_sessions (user_id, start_time);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration numeric(10,2) not null default 0,
  type text not null default 'other',
  participants jsonb not null default '[]'::jsonb,
  agenda text,
  outcomes jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled',
  efficiency numeric(8,2),
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_meetings_start_time on public.meetings (start_time);

drop trigger if exists trg_focus_sessions_updated_at on public.focus_sessions;
create trigger trg_focus_sessions_updated_at before update on public.focus_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at before update on public.meetings
for each row execute function public.set_updated_at();

alter table public.focus_sessions enable row level security;
alter table public.meetings enable row level security;

drop policy if exists "focus_sessions_owner_manager_admin" on public.focus_sessions;
create policy "focus_sessions_owner_manager_admin" on public.focus_sessions
for all using (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "meetings_owner_manager_admin" on public.meetings;
create policy "meetings_owner_manager_admin" on public.meetings
for all using (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
  or participants @> jsonb_build_array((select id::text from public.profiles where auth_user_id = auth.uid()))
) with check (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);
