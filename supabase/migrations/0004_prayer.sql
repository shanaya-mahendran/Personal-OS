-- ============================================================================
-- 0004_prayer.sql — annual schedule integrity
-- Prayer times are user-provided (imported). No calculation, ever.
-- ============================================================================

-- Constraint: the calendar date must fall inside the declared schedule_year.
alter table public.prayer_schedules
  drop constraint if exists prayer_schedule_year_matches_date;

alter table public.prayer_schedules
  add constraint prayer_schedule_year_matches_date
  check (extract(year from date) = schedule_year);

-- Index for the daily map lookups.
create index if not exists prayer_schedules_user_date_idx
  on public.prayer_schedules (user_id, date);

create index if not exists prayer_logs_user_date_idx
  on public.prayer_logs (user_id, date);

-- One logical import unit per (user, year) is enforced by the unique date
-- constraint in 0001; this view answers "is this year fully configured?"
create or replace view public.prayer_year_coverage
with (security_invoker = on) as
select
  user_id,
  schedule_year,
  count(*) as days_configured,
  min(date) as first_date,
  max(date) as last_date
from public.prayer_schedules
group by user_id, schedule_year;
