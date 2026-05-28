-- Run in Supabase SQL Editor for the Performance module.

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

-- Triggers
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

-- RLS
alter table public.kpis enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.kpi_scores enable row level security;
alter table public.goals enable row level security;
alter table public.feedback_360 enable row level security;
alter table public.feedback_criteria enable row level security;
alter table public.salary_reviews enable row level security;
alter table public.self_assessments enable row level security;

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
