-- ============================================================================
-- 0007_architect_and_fixes.sql
--
-- Run ONLY this file against an EXISTING database that already has migrations
-- 0001-0006 applied. Do NOT run full_schema.sql on an existing database.
-- This file is fully idempotent — safe to re-run multiple times.
--
-- A) BUG FIX: Re-apply RLS policies so the `authenticated` role has explicit
--    INSERT/SELECT/UPDATE/DELETE access on every user-owned table.
--    Also grants schema/table/sequence privileges to the authenticated role.
--
-- B) FEATURE: The Architect — Intelligent Life Architecture System.
--    Three new tables (created only if they do not already exist):
--      growth_plans          — 3-month growth cycles
--      reflections           — Quarterly + 15-day journal entries
--      habit_tracker_entries — Architect-specific daily habit tracking
-- ============================================================================

-- ── A) RLS BUG FIX ───────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'areas', 'projects', 'tasks', 'captures', 'attachments', 'event_sources',
    'events', 'notes', 'ideas', 'memories', 'prayer_schedules', 'prayer_logs',
    'career_opportunities', 'career_applications', 'interviews', 'volunteering',
    'volunteering_events', 'habits', 'habit_logs', 'meals', 'water_logs',
    'karate_sessions', 'karate_goals', 'entertainment_logs', 'music_sessions',
    'notifications', 'audit_logs', 'chat_messages', 'known_places',
    'branding_content', 'branding_metrics', 'family_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    -- Drop old policies (any name variant) before re-creating.
    execute format('drop policy if exists own_rows         on public.%I', t);
    execute format('drop policy if exists own_rows_select  on public.%I', t);
    execute format('drop policy if exists own_rows_insert  on public.%I', t);
    execute format('drop policy if exists own_rows_update  on public.%I', t);
    execute format('drop policy if exists own_rows_delete  on public.%I', t);

    execute format(
      'create policy own_rows_select on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy own_rows_insert on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy own_rows_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy own_rows_delete on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;

  -- profiles (pk = id, not user_id)
  alter table public.profiles enable row level security;
  drop policy if exists own_rows        on public.profiles;
  drop policy if exists own_rows_select on public.profiles;
  drop policy if exists own_rows_insert on public.profiles;
  drop policy if exists own_rows_update on public.profiles;
  create policy own_rows_select on public.profiles for select using (auth.uid() = id);
  create policy own_rows_insert on public.profiles for insert with check (auth.uid() = id);
  create policy own_rows_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

  -- settings (pk = user_id)
  alter table public.settings enable row level security;
  drop policy if exists own_rows        on public.settings;
  drop policy if exists own_rows_select on public.settings;
  drop policy if exists own_rows_insert on public.settings;
  drop policy if exists own_rows_update on public.settings;
  create policy own_rows_select on public.settings for select using (auth.uid() = user_id);
  create policy own_rows_insert on public.settings for insert with check (auth.uid() = user_id);
  create policy own_rows_update on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

  -- ai_runs (pk = id, keyed by user_id)
  alter table public.ai_runs enable row level security;
  drop policy if exists own_rows        on public.ai_runs;
  drop policy if exists own_rows_select on public.ai_runs;
  drop policy if exists own_rows_insert on public.ai_runs;
  drop policy if exists own_rows_update on public.ai_runs;
  create policy own_rows_select on public.ai_runs for select using (auth.uid() = user_id);
  create policy own_rows_insert on public.ai_runs for insert with check (auth.uid() = user_id);
  create policy own_rows_update on public.ai_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
end;
$$;

-- Grant the authenticated role access to all existing + future tables.
grant usage  on schema public                          to authenticated;
grant all privileges on all tables    in schema public to authenticated;
grant all privileges on all sequences in schema public to authenticated;

-- ── B) FEATURE: THE ARCHITECT ────────────────────────────────────────────────

-- Enums — idempotent via DO block to avoid "type already exists" errors.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'growth_phase') then
    create type growth_phase as enum ('cut_excess', 'build_foundation', 'broaden_horizons');
  end if;

  if not exists (select 1 from pg_type where typname = 'reflection_kind') then
    create type reflection_kind as enum ('quarterly_mirror', 'pulse_check_15d');
  end if;
end;
$$;

-- A 3-month growth cycle.
create table if not exists public.growth_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null default '3-Month Growth Plan',
  started_at    date not null default current_date,
  ends_at       date not null default (current_date + interval '90 days'),
  current_phase growth_phase not null default 'cut_excess',
  phase_notes   jsonb not null default '{}'::jsonb,
  goals         jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Quarterly mirror + 15-day pulse check journal entries.
create table if not exists public.reflections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  plan_id         uuid references public.growth_plans (id) on delete cascade,
  kind            reflection_kind not null,
  answers         jsonb not null default '{}'::jsonb,
  ai_insights     text,
  completion_rate numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Per-habit daily tracking entries linked to a growth plan.
create table if not exists public.habit_tracker_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  plan_id     uuid references public.growth_plans (id) on delete cascade,
  habit_name  text not null,
  date        date not null,
  completed   boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, habit_name, date)
);

-- RLS + updated_at triggers for the new Architect tables.
do $$
declare t text;
begin
  foreach t in array array['growth_plans', 'reflections', 'habit_tracker_entries'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists own_rows        on public.%I', t);
    execute format('drop policy if exists own_rows_select on public.%I', t);
    execute format('drop policy if exists own_rows_insert on public.%I', t);
    execute format('drop policy if exists own_rows_update on public.%I', t);
    execute format('drop policy if exists own_rows_delete on public.%I', t);

    execute format(
      'create policy own_rows_select on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy own_rows_insert on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy own_rows_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy own_rows_delete on public.%I for delete using (auth.uid() = user_id)', t);

    execute format('drop trigger if exists set_updated_at on public.%I', t);
    perform public.apply_updated_at(format('public.%I', t));
  end loop;
end;
$$;

grant all privileges on table public.growth_plans          to authenticated;
grant all privileges on table public.reflections           to authenticated;
grant all privileges on table public.habit_tracker_entries to authenticated;

-- Indexes — idempotent.
create index if not exists growth_plans_user_active_idx on public.growth_plans (user_id, is_active);
create index if not exists reflections_user_plan_idx     on public.reflections (user_id, plan_id, kind);
create index if not exists habit_tracker_user_date_idx   on public.habit_tracker_entries (user_id, date);
