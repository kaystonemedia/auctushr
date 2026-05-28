-- StyleTry full Supabase schema + RLS policies.
-- Run this in Supabase SQL editor as a single migration.

create extension if not exists "pgcrypto";

-- =====================================================
-- Shared types and helpers
-- =====================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'manager', 'employee');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- =====================================================
-- Core identity and org tables
-- =====================================================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  manager_profile_id uuid,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  uid text generated always as (auth_user_id::text) stored,
  email text not null unique,
  role public.user_role not null default 'employee',
  first_name text not null default '',
  last_name text not null default '',
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  department text,
  department_id uuid references public.departments(id) on delete set null,
  position text,
  manager_id uuid references public.profiles(id) on delete set null,
  phone text,
  mobile_number text,
  status text not null default 'active',
  has_password boolean not null default true,
  requires_password_change boolean not null default false,
  hire_date date,
  salary numeric(12,2),
  bank_account jsonb,
  address jsonb,
  emergency_contact jsonb,
  documents jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'departments_manager_profile_fk'
  ) then
    alter table public.departments
      add constraint departments_manager_profile_fk
      foreign key (manager_profile_id) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_department_id_idx on public.profiles(department_id);
create index if not exists profiles_manager_id_idx on public.profiles(manager_id);
create index if not exists profiles_status_idx on public.profiles(status);

-- =====================================================
-- Role helper functions (require public.profiles to exist)
-- =====================================================
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('admin', 'manager'), false);
$$;

-- =====================================================
-- Functional domain tables
-- =====================================================
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

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

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text,
  department text,
  manager_id uuid references public.profiles(id) on delete set null,
  date date not null,
  status text not null default 'present',
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_location jsonb,
  check_out_location jsonb,
  check_in_device jsonb,
  check_out_device jsonb,
  idle_time_minutes integer,
  total_hours numeric(8,2),
  active_time_minutes integer,
  approval_status text not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  notes text,
  flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (employee_id, date)
);

alter table if exists public.attendance_records
  add column if not exists employee_name text;
alter table if exists public.attendance_records
  add column if not exists department text;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  type text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending',
  reason text,
  attachments jsonb not null default '[]'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Document id matches legacy Firestore pattern: {profile_id}_{year}
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

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigner_id uuid references public.profiles(id) on delete set null,
  department text,
  priority text not null default 'medium',
  status text not null default 'backlog',
  category text not null default 'general',
  due_date timestamptz,
  completed_at timestamptz,
  estimated_hours numeric(8,2),
  actual_hours numeric(8,2),
  progress integer,
  project_id uuid,
  tags jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id) on delete cascade,
  assignment_type text not null default 'user',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (task_id, assignee_id)
);

create table if not exists public.task_records (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  notes text,
  productivity_score numeric(8,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.productivity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  productivity_score numeric(8,2),
  focus_time_minutes integer,
  meeting_time_minutes integer,
  task_completion_rate numeric(8,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, date)
);

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

-- Performance management
create table if not exists public.kpis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  type text not null,
  unit text not null default '',
  target numeric(12,2) not null default 0,
  weight numeric(8,2) not null default 0,
  calculation_method text not null default 'manual',
  formula text,
  data_source text,
  department_id text,
  role_id text,
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  review_period jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  type text not null default 'annual',
  overall_rating numeric(4,2) not null default 0,
  overall_comments text not null default '',
  kpi_scores jsonb not null default '[]'::jsonb,
  feedback_360 jsonb not null default '[]'::jsonb,
  previous_goals jsonb not null default '[]'::jsonb,
  new_goals jsonb not null default '[]'::jsonb,
  development_plan jsonb not null default '{}'::jsonb,
  salary_review jsonb,
  self_assessment jsonb,
  manager_comments text not null default '',
  manager_recommendations jsonb not null default '[]'::jsonb,
  hr_comments text,
  hr_approval boolean,
  hr_approved_by uuid references public.profiles(id) on delete set null,
  hr_approved_at timestamptz,
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_performance_reviews_employee on public.performance_reviews (employee_id, created_at desc);
create index if not exists idx_performance_reviews_reviewer on public.performance_reviews (reviewer_id, created_at desc);
create index if not exists idx_performance_reviews_status on public.performance_reviews (status, completed_at);

create table if not exists public.kpi_scores (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.performance_reviews(id) on delete cascade,
  actual_value numeric(12,2) not null default 0,
  target_value numeric(12,2) not null default 0,
  score numeric(4,2) not null default 0,
  percentage numeric(8,2) not null default 0,
  employee_comments text,
  manager_comments text,
  evidence jsonb not null default '[]'::jsonb,
  data_points jsonb not null default '[]'::jsonb,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'performance',
  priority text not null default 'medium',
  start_date timestamptz,
  target_date timestamptz,
  completed_date timestamptz,
  status text not null default 'not_started',
  progress integer not null default 0,
  measurement_criteria text,
  success_metrics jsonb not null default '[]'::jsonb,
  required_resources jsonb not null default '[]'::jsonb,
  support_needed jsonb not null default '[]'::jsonb,
  quarterly_reviews jsonb not null default '[]'::jsonb,
  parent_goal_id uuid references public.goals(id) on delete set null,
  linked_kpis jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.feedback_360 (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  provider_type text not null,
  ratings jsonb not null default '[]'::jsonb,
  strengths text not null default '',
  areas_for_improvement text not null default '',
  general_comments text not null default '',
  status text not null default 'pending',
  is_anonymous boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create table if not exists public.feedback_criteria (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default '',
  weight numeric(8,2) not null default 0,
  is_active boolean not null default true,
  department_id text,
  role_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.salary_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.performance_reviews(id) on delete cascade,
  current_salary numeric(12,2) not null default 0,
  current_benefits jsonb not null default '[]'::jsonb,
  recommended_salary numeric(12,2) not null default 0,
  salary_increase numeric(12,2) not null default 0,
  increase_percentage numeric(8,2) not null default 0,
  performance_justification text,
  market_analysis text,
  budget_impact numeric(12,2) not null default 0,
  manager_approval boolean not null default false,
  hr_approval boolean not null default false,
  executive_approval boolean,
  effective_date timestamptz,
  implementation_notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.self_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  self_ratings jsonb not null default '[]'::jsonb,
  key_accomplishments jsonb not null default '[]'::jsonb,
  goals_achieved jsonb not null default '[]'::jsonb,
  challenges jsonb not null default '[]'::jsonb,
  strengths_identified jsonb not null default '[]'::jsonb,
  areas_for_improvement jsonb not null default '[]'::jsonb,
  development_interests jsonb not null default '[]'::jsonb,
  proposed_goals jsonb not null default '[]'::jsonb,
  career_aspirations jsonb not null default '[]'::jsonb,
  support_needed jsonb not null default '[]'::jsonb,
  training_requests jsonb not null default '[]'::jsonb,
  additional_comments text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  period_month text not null,
  basic_salary numeric(12,2) not null default 0,
  gross_salary numeric(12,2) not null default 0,
  net_salary numeric(12,2) not null default 0,
  allowances jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  overtime_hours numeric(8,2) default 0,
  overtime_rate numeric(8,2) default 1,
  bonus numeric(12,2) default 0,
  status text not null default 'pending',
  payment_date timestamptz,
  payment_method text,
  payment jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text,
  message text not null,
  severity text not null default 'info',
  read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  name text not null,
  type text,
  category text,
  storage_path text not null,
  storage_bucket text not null default 'documents',
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text,
  provider text,
  status text not null,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.monitoring_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.legacy_firestore_dump (
  id uuid primary key default gen_random_uuid(),
  collection_name text not null,
  legacy_document_id text not null,
  payload jsonb not null,
  migrated_at timestamptz not null default timezone('utc'::text, now()),
  unique (collection_name, legacy_document_id)
);

-- =====================================================
-- Triggers
-- =====================================================
drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_office_locations_updated_at on public.office_locations;
create trigger trg_office_locations_updated_at before update on public.office_locations
for each row execute function public.set_updated_at();

drop trigger if exists trg_attendance_records_updated_at on public.attendance_records;
create trigger trg_attendance_records_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_leave_requests_updated_at on public.leave_requests;
create trigger trg_leave_requests_updated_at before update on public.leave_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_leave_balances_updated_at on public.leave_balances;
create trigger trg_leave_balances_updated_at before update on public.leave_balances
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_productivity_records_updated_at on public.productivity_records;
create trigger trg_productivity_records_updated_at before update on public.productivity_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_focus_sessions_updated_at on public.focus_sessions;
create trigger trg_focus_sessions_updated_at before update on public.focus_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at before update on public.meetings
for each row execute function public.set_updated_at();

drop trigger if exists trg_kpis_updated_at on public.kpis;
create trigger trg_kpis_updated_at before update on public.kpis
for each row execute function public.set_updated_at();

drop trigger if exists trg_performance_reviews_updated_at on public.performance_reviews;
create trigger trg_performance_reviews_updated_at before update on public.performance_reviews
for each row execute function public.set_updated_at();

drop trigger if exists trg_kpi_scores_updated_at on public.kpi_scores;
create trigger trg_kpi_scores_updated_at before update on public.kpi_scores
for each row execute function public.set_updated_at();

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists trg_feedback_360_updated_at on public.feedback_360;
create trigger trg_feedback_360_updated_at before update on public.feedback_360
for each row execute function public.set_updated_at();

drop trigger if exists trg_feedback_criteria_updated_at on public.feedback_criteria;
create trigger trg_feedback_criteria_updated_at before update on public.feedback_criteria
for each row execute function public.set_updated_at();

drop trigger if exists trg_salary_reviews_updated_at on public.salary_reviews;
create trigger trg_salary_reviews_updated_at before update on public.salary_reviews
for each row execute function public.set_updated_at();

drop trigger if exists trg_self_assessments_updated_at on public.self_assessments;
create trigger trg_self_assessments_updated_at before update on public.self_assessments
for each row execute function public.set_updated_at();

drop trigger if exists trg_payroll_entries_updated_at on public.payroll_entries;
create trigger trg_payroll_entries_updated_at before update on public.payroll_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();

-- =====================================================
-- Row level security
-- =====================================================
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.office_locations enable row level security;
alter table public.attendance_records enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_records enable row level security;
alter table public.productivity_records enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.meetings enable row level security;
alter table public.kpis enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.kpi_scores enable row level security;
alter table public.goals enable row level security;
alter table public.feedback_360 enable row level security;
alter table public.feedback_criteria enable row level security;
alter table public.salary_reviews enable row level security;
alter table public.self_assessments enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.email_logs enable row level security;
alter table public.monitoring_events enable row level security;
alter table public.legacy_firestore_dump enable row level security;

drop policy if exists "departments_read_managers_admins" on public.departments;
create policy "departments_read_managers_admins" on public.departments
for select using (public.is_manager_or_admin());
drop policy if exists "departments_admin_write" on public.departments;
create policy "departments_admin_write" on public.departments
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_self_or_admin_read" on public.profiles;
create policy "profiles_self_or_admin_read" on public.profiles
for select using (auth.uid() = auth_user_id or public.is_manager_or_admin());
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update using (auth.uid() = auth_user_id or public.is_admin())
with check (auth.uid() = auth_user_id or public.is_admin());
drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
for insert with check (public.is_admin());

drop policy if exists "settings_admin_only" on public.app_settings;
create policy "settings_admin_only" on public.app_settings
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "office_locations_read_authenticated" on public.office_locations;
create policy "office_locations_read_authenticated" on public.office_locations
for select using (auth.uid() is not null);

drop policy if exists "office_locations_manager_admin_write" on public.office_locations;
create policy "office_locations_manager_admin_write" on public.office_locations
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

drop policy if exists "attendance_owner_manager_admin" on public.attendance_records;
create policy "attendance_owner_manager_admin" on public.attendance_records
for select using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or manager_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "attendance_write_owner_manager_admin" on public.attendance_records;
create policy "attendance_write_owner_manager_admin" on public.attendance_records
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "leave_owner_manager_admin" on public.leave_requests;
create policy "leave_owner_manager_admin" on public.leave_requests
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or manager_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

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

drop policy if exists "tasks_assignees_assigner_admin_read" on public.tasks;
create policy "tasks_assignees_assigner_admin_read" on public.tasks
for select using (
  public.is_manager_or_admin()
  or assigner_id = (select id from public.profiles where auth_user_id = auth.uid())
  or exists (
    select 1 from public.task_assignees ta
    where ta.task_id = tasks.id
      and ta.assignee_id = (select id from public.profiles where auth_user_id = auth.uid())
  )
);
drop policy if exists "tasks_manager_admin_write" on public.tasks;
create policy "tasks_manager_admin_write" on public.tasks
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

drop policy if exists "task_assignees_visibility" on public.task_assignees;
create policy "task_assignees_visibility" on public.task_assignees
for all using (
  public.is_manager_or_admin()
  or assignee_id = (select id from public.profiles where auth_user_id = auth.uid())
) with check (public.is_manager_or_admin());

drop policy if exists "task_records_read_participants" on public.task_records;
create policy "task_records_read_participants" on public.task_records
for select using (
  public.is_manager_or_admin()
  or user_id = (select id from public.profiles where auth_user_id = auth.uid())
);
drop policy if exists "task_records_write_managers_admins" on public.task_records;
create policy "task_records_write_managers_admins" on public.task_records
for insert with check (public.is_manager_or_admin());

drop policy if exists "productivity_owner_manager_admin" on public.productivity_records;
create policy "productivity_owner_manager_admin" on public.productivity_records
for all using (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

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

drop policy if exists "kpis_read_authenticated" on public.kpis;
create policy "kpis_read_authenticated" on public.kpis
for select using (auth.uid() is not null);

drop policy if exists "kpis_manager_admin_write" on public.kpis;
create policy "kpis_manager_admin_write" on public.kpis
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

drop policy if exists "performance_reviews_participants" on public.performance_reviews;
create policy "performance_reviews_participants" on public.performance_reviews
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or reviewer_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or reviewer_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "kpi_scores_participants" on public.kpi_scores;
create policy "kpi_scores_participants" on public.kpi_scores
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "goals_owner_manager_admin" on public.goals;
create policy "goals_owner_manager_admin" on public.goals
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "feedback_360_participants" on public.feedback_360;
create policy "feedback_360_participants" on public.feedback_360
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or provider_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  provider_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "feedback_criteria_read_authenticated" on public.feedback_criteria;
create policy "feedback_criteria_read_authenticated" on public.feedback_criteria
for select using (auth.uid() is not null);

drop policy if exists "feedback_criteria_manager_admin_write" on public.feedback_criteria;
create policy "feedback_criteria_manager_admin_write" on public.feedback_criteria
for all using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

drop policy if exists "salary_reviews_hr_admin" on public.salary_reviews;
create policy "salary_reviews_hr_admin" on public.salary_reviews
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (public.is_manager_or_admin());

drop policy if exists "self_assessments_owner" on public.self_assessments;
create policy "self_assessments_owner" on public.self_assessments
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "payroll_owner_admin_read" on public.payroll_entries;
create policy "payroll_owner_admin_read" on public.payroll_entries
for select using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "payroll_admin_write" on public.payroll_entries;
create policy "payroll_admin_write" on public.payroll_entries
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_owner_read_write" on public.notifications;
create policy "notifications_owner_read_write" on public.notifications
for all using (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
) with check (
  user_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "documents_owner_manager_admin" on public.documents;
create policy "documents_owner_manager_admin" on public.documents
for all using (
  owner_id = (select id from public.profiles where auth_user_id = auth.uid())
  or employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  owner_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "audit_logs_admin_only" on public.audit_logs;
create policy "audit_logs_admin_only" on public.audit_logs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "email_logs_admin_only" on public.email_logs;
create policy "email_logs_admin_only" on public.email_logs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "monitoring_events_owner_manager_admin" on public.monitoring_events;
create policy "monitoring_events_owner_manager_admin" on public.monitoring_events
for all using (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
) with check (
  employee_id = (select id from public.profiles where auth_user_id = auth.uid())
  or public.is_manager_or_admin()
);

drop policy if exists "legacy_dump_admin_only" on public.legacy_firestore_dump;
create policy "legacy_dump_admin_only" on public.legacy_firestore_dump
for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================
-- Seed singleton records
-- =====================================================
insert into public.app_settings (key, value)
values ('global', '{}'::jsonb)
on conflict (key) do nothing;

