-- Run in Supabase SQL Editor.
-- Adds biweekly pay-period support + snapshot fields to payroll_entries, and an
-- auto-generated Employee ID + SSNIT number to profiles.
-- Additive only: existing `period_month` data is preserved and backfilled into
-- the new columns as legacy monthly entries.

-- =============================================================================
-- profiles: auto-generated Employee ID (EMP-0001, EMP-0002, ...) + SSNIT number
-- =============================================================================

create sequence if not exists public.employee_code_seq;

alter table public.profiles
  add column if not exists employee_code text;

alter table public.profiles
  add column if not exists ssnit_number text;

-- Backfill existing profiles in creation order so earlier employees keep lower codes.
do $$
declare
  rec record;
begin
  for rec in
    select id from public.profiles where employee_code is null order by created_at, id
  loop
    update public.profiles
    set employee_code = 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 4, '0')
    where id = rec.id;
  end loop;
end $$;

alter table public.profiles
  alter column employee_code set default (
    'EMP-' || lpad(nextval('public.employee_code_seq')::text, 4, '0')
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_employee_code_key'
  ) then
    alter table public.profiles
      add constraint profiles_employee_code_key unique (employee_code);
  end if;
end $$;

alter table public.profiles
  alter column employee_code set not null;

-- =============================================================================
-- payroll_entries: biweekly period columns + snapshot fields
-- =============================================================================

alter table public.payroll_entries
  add column if not exists period_start_date date;

alter table public.payroll_entries
  add column if not exists period_end_date date;

alter table public.payroll_entries
  add column if not exists pay_frequency text not null default 'biweekly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payroll_entries_pay_frequency_check'
  ) then
    alter table public.payroll_entries
      add constraint payroll_entries_pay_frequency_check
      check (pay_frequency in ('biweekly', 'monthly_legacy'));
  end if;
end $$;

alter table public.payroll_entries
  add column if not exists days_worked numeric(5,2);

alter table public.payroll_entries
  add column if not exists days_absent numeric(5,2);

alter table public.payroll_entries
  add column if not exists currency text not null default 'GHS';

alter table public.payroll_entries
  add column if not exists exchange_rate numeric(12,6);

-- Backfill existing monthly rows: derive a start/end date range from period_month
-- and tag them as legacy so new biweekly logic can tell them apart.
update public.payroll_entries
set
  period_start_date = to_date(period_month || '-01', 'YYYY-MM-DD'),
  period_end_date = (to_date(period_month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date,
  pay_frequency = 'monthly_legacy'
where period_month is not null
  and period_start_date is null;

-- period_month is kept for legacy display but is no longer required for new rows.
alter table public.payroll_entries
  alter column period_month drop not null;
