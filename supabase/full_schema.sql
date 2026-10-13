-- ============================================================================
-- SHANAYA OS — FULL DATABASE SCHEMA (CONSOLIDATED)
-- Paste and run this script in the Supabase Dashboard SQL Editor
-- https://supabase.com/dashboard/project/bqznwhtoiensvhbvoqcb/sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FILE: supabase/migrations/0001_init.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 0001_init.sql — Shanaya OS core schema
-- Every user-owned table carries user_id + created_at/updated_at with a
-- shared touch trigger.
-- ============================================================================

-- ── Extensions ─────────────────────────────────────────────────────────────
-- pgvector MUST be in the public schema so its operators (<=> etc.) are
-- reachable without an explicit schema-qualified search_path override.
-- uuid-ossp and pg_trgm are safe in extensions (no custom operators in SQL).
create extension if not exists vector       with schema public;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm      with schema extensions;

-- ── Enums ────────────────────────────────────────────────────────────────────
create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type event_status as enum ('scheduled', 'cancelled', 'completed');
create type capture_input_type as enum ('text', 'image', 'voice', 'document', 'paste');
create type capture_status as enum ('pending', 'processing', 'awaiting_confirmation', 'confirmed', 'rejected', 'failed');
create type memory_kind as enum ('decision', 'lesson', 'preference', 'fact', 'experience');
create type prayer_name as enum ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha');
create type career_type as enum ('internship', 'full_time', 'part_time', 'contract');
create type work_mode as enum ('remote', 'hybrid', 'onsite');
create type career_status as enum ('saved', 'applied', 'screening', 'interview', 'technical', 'offer', 'accepted', 'rejected', 'withdrawn');
create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type karate_focus as enum ('kata', 'kumite', 'conditioning', 'technique', 'grading', 'competition');
create type entertainment_category as enum ('movie', 'tv', 'anime', 'game', 'music', 'youtube', 'book', 'social');
create type music_mood as enum ('focus', 'calm', 'energetic', 'happy', 'sad', 'social', 'travel', 'custom');
create type idea_status as enum ('seed', 'exploring', 'parked', 'promoted');
create type project_status as enum ('active', 'paused', 'done', 'archived');
create type audit_source as enum ('user', 'ai', 'system');
create type chat_role as enum ('user', 'assistant');

-- ── updated_at touch trigger ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.apply_updated_at(target regclass)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger set_updated_at before update on %s for each row execute function public.set_updated_at()',
    target
  );
end;
$$;

-- ── Profiles & settings ─────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Colombo',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notification_prefs jsonb not null default '{"reminders": true, "lead_minutes": 15, "categories": {"events": true, "tasks": true, "prayers": false}}'::jsonb,
  dashboard_prefs jsonb not null default '{}'::jsonb,
  context_engine_enabled boolean not null default true,
  location_enabled boolean not null default false,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Life structure ──────────────────────────────────────────────────────────
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  title text not null,
  description text,
  goal text,
  status project_status not null default 'active',
  deadline_at timestamptz,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  recurrence_rule text,
  reminder_at timestamptz,
  source_capture_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  input_type capture_input_type not null default 'text',
  raw_text text,
  storage_path text,
  processing_status capture_status not null default 'pending',
  ai_result jsonb,
  confidence jsonb,
  created_entity_type text,
  created_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.tasks
  add constraint tasks_source_capture_fk
  foreign key (source_capture_id) references public.captures (id) on delete set null;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  capture_id uuid references public.captures (id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  capture_id uuid references public.captures (id) on delete set null,
  type text not null default 'capture',
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'Asia/Colombo',
  location text,
  organizer text,
  source_id uuid references public.event_sources (id) on delete set null,
  status event_status not null default 'scheduled',
  recurrence_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index events_user_start_idx on public.events (user_id, start_at);

-- ── Notes, ideas, memories ──────────────────────────────────────────────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  area_id uuid references public.areas (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  tags text[] default '{}',
  source_capture_id uuid references public.captures (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  status idea_status not null default 'seed',
  area_id uuid references public.areas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind memory_kind not null,
  title text not null,
  body text not null,
  source_capture_id uuid references public.captures (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Populated by the generate-embedding edge function (0003 adds the vector).
create table public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null unique references public.memories (id) on delete cascade,
  embedding vector(768),
  created_at timestamptz not null default now()
);

-- ── Prayer ──────────────────────────────────────────────────────────────────
create table public.prayer_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  fajr time not null,
  dhuhr time not null,
  asr time not null,
  maghrib time not null,
  isha time not null,
  schedule_year int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  prayer prayer_name not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, prayer)
);

-- ── Career ──────────────────────────────────────────────────────────────────
create table public.career_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  role text not null,
  type career_type,
  location text,
  work_mode work_mode,
  salary text,
  hours text,
  requirements text[] default '{}',
  url text,
  contact text,
  status career_status not null default 'saved',
  deadline_at timestamptz,
  notes text,
  source_capture_id uuid references public.captures (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.career_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.career_opportunities (id) on delete cascade,
  applied_at timestamptz not null default now(),
  resume_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.career_opportunities (id) on delete cascade,
  scheduled_at timestamptz not null,
  round text,
  notes text,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Volunteering ────────────────────────────────────────────────────────────
create table public.volunteering (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization text not null,
  opportunity text not null,
  role text,
  date date,
  hours numeric(6, 2),
  description text,
  certificate_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.volunteering_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  volunteering_id uuid not null references public.volunteering (id) on delete cascade,
  event_date date not null,
  hours numeric(6, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Habits ──────────────────────────────────────────────────────────────────
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cadence text not null default 'daily',
  target numeric,
  area_id uuid references public.areas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  value numeric,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

-- ── Eating ──────────────────────────────────────────────────────────────────
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal_type meal_type not null,
  description text,
  home_cooked boolean not null default false,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, meal_type)
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  glasses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ── Karate ──────────────────────────────────────────────────────────────────
create table public.karate_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  duration_min int not null default 0,
  focus karate_focus not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.karate_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  target_date date,
  progress numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Entertainment ───────────────────────────────────────────────────────────
create table public.entertainment_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  category entertainment_category not null,
  title text not null,
  duration_min int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.music_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  track text,
  artist text,
  mood music_mood not null default 'focus',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Notifications, audit, AI runs, chat ─────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  entity_type text,
  entity_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  source audit_source not null default 'user',
  ai_run_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  model text,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  status text not null default 'ok' check (status in ('ok', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create index ai_runs_user_fn_time_idx on public.ai_runs (user_id, function_name, created_at);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role chat_role not null,
  content text not null,
  tool_proposal jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Known places (geofences, context engine) ────────────────────────────────
create table public.known_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_m int not null default 150 check (radius_m > 0 and radius_m <= 5000),
  context_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Apply updated_at triggers ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'settings', 'areas', 'projects', 'tasks', 'captures',
    'attachments', 'event_sources', 'events', 'notes', 'ideas', 'memories',
    'prayer_schedules', 'prayer_logs', 'career_opportunities',
    'career_applications', 'interviews', 'volunteering', 'volunteering_events',
    'habits', 'habit_logs', 'meals', 'water_logs', 'karate_sessions',
    'karate_goals', 'entertainment_logs', 'music_sessions', 'notifications',
    'audit_logs', 'chat_messages', 'known_places'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    perform public.apply_updated_at(format('public.%I', t));
  end loop;
end;
$$;

-- ── Useful indexes ──────────────────────────────────────────────────────────
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_user_project_idx on public.tasks (user_id, project_id);
create index captures_user_created_idx on public.captures (user_id, created_at desc);
create index events_user_range_idx on public.events (user_id, start_at, end_at);
create index notes_user_idx on public.notes (user_id, created_at desc);
create index memories_user_idx on public.memories (user_id, created_at desc);
create index career_user_status_idx on public.career_opportunities (user_id, status);
create index entertainment_user_date_idx on public.entertainment_logs (user_id, date);
create index notifications_user_scheduled_idx on public.notifications (user_id, scheduled_at);


-- ----------------------------------------------------------------------------
-- FILE: supabase/migrations/0002_rls.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 0002_rls.sql — Row Level Security on every table
-- Multi-user safe from day one: rows are only visible/writable by their owner.
-- ============================================================================

-- Helper: standard own-rows policy (user_id = auth.uid()).
create or replace function public.apply_own_rows_policy(target regclass, policy_name text default 'own_rows')
returns void
language plpgsql
as $$
begin
  execute format('alter table %s enable row level security', target);
  execute format('drop policy if exists %I on %s', policy_name, target);
  execute format(
    'create policy %I on %s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
    policy_name, target
  );
end;
$$;

-- Helper: profiles/settings keyed directly by id/user_id = auth.uid()
create or replace function public.apply_uid_pk_policy(target regclass, uid_column text, policy_name text default 'own_rows')
returns void
language plpgsql
as $$
begin
  execute format('alter table %s enable row level security', target);
  execute format('drop policy if exists %I on %s', policy_name, target);
  execute format(
    'create policy %I on %s for all using (auth.uid() = %I) with check (auth.uid() = %I)',
    policy_name, target, uid_column, uid_column
  );
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'areas', 'projects', 'tasks', 'captures', 'attachments', 'event_sources',
    'events', 'notes', 'ideas', 'memories', 'prayer_schedules', 'prayer_logs',
    'career_opportunities', 'career_applications', 'interviews', 'volunteering',
    'volunteering_events', 'habits', 'habit_logs', 'meals', 'water_logs',
    'karate_sessions', 'karate_goals', 'entertainment_logs', 'music_sessions',
    'notifications', 'audit_logs', 'chat_messages', 'known_places'
  ] loop
    perform public.apply_own_rows_policy(format('public.%I', t));
  end loop;

  -- Tables keyed by user id (no separate id column).
  perform public.apply_uid_pk_policy('public.profiles', 'id');
  perform public.apply_uid_pk_policy('public.settings', 'user_id');

  -- memory_embeddings has no user_id; its parent memories row is RLS-protected,
  -- and we expose access only through security-invoker views/functions.
  execute 'alter table public.memory_embeddings enable row level security';
  execute 'drop policy if exists own_rows on public.memory_embeddings';
  execute 'create policy own_rows on public.memory_embeddings for all
           using (exists (
             select 1 from public.memories m
             where m.id = memory_embeddings.memory_id and m.user_id = auth.uid()
           ))
           with check (exists (
             select 1 from public.memories m
             where m.id = memory_embeddings.memory_id and m.user_id = auth.uid()
           ))';

  -- ai_runs: owner read/write; also read by the owner's own rate limiting.
  perform public.apply_uid_pk_policy('public.ai_runs', 'user_id');
end;
$$;


-- ----------------------------------------------------------------------------
-- FILE: supabase/migrations/0003_pgvector.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 0003_pgvector.sql — semantic memory search
-- Gemini text-embedding-004 produces 768-dim vectors.
-- ============================================================================

create extension if not exists vector;

alter table public.memory_embeddings
  alter column embedding type vector(768);

create index if not exists memory_embeddings_embedding_idx
  on public.memory_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Helper used by Edge Functions / server: text -> embedding handled client-side
-- (Gemini), this function ranks an already-computed embedding.
create or replace function public.match_memories(
  query_embedding vector(768),
  match_count int default 10,
  query_text text default null
)
returns table (
  id uuid,
  kind memory_kind,
  title text,
  body text,
  source_capture_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
security invoker
-- Include both schemas so the <=> operator is found whether vector was
-- installed in public (preferred) or extensions (legacy).
set search_path = public, extensions
as $$
  select
    m.id,
    m.kind,
    m.title,
    m.body,
    m.source_capture_id,
    m.created_at,
    1 - (me.embedding <=> query_embedding) as similarity
  from public.memory_embeddings me
  join public.memories m on m.id = me.memory_id
  where m.user_id = auth.uid()
    and me.embedding is not null
  order by me.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Convenience: text search variant used by the assistant when no embedding is
-- available (keeps search_memory functional without a network round trip).
create or replace function public.search_memories_text(
  query_text text,
  match_count int default 10
)
returns table (
  id uuid,
  kind memory_kind,
  title text,
  body text,
  source_capture_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.kind,
    m.title,
    m.body,
    m.source_capture_id,
    m.created_at,
    case
      when m.title @@ plainto_tsquery('english', query_text)
        or m.body @@ plainto_tsquery('english', query_text) then 1.0
      else 0.0
    end as similarity
  from public.memories m
  where m.user_id = auth.uid()
    and (
      m.title @@ plainto_tsquery('english', query_text)
      or m.body @@ plainto_tsquery('english', query_text)
      or m.title ilike '%' || query_text || '%'
      or m.body ilike '%' || query_text || '%'
    )
  order by similarity desc, m.created_at desc
  limit greatest(match_count, 1);
$$;


-- ----------------------------------------------------------------------------
-- FILE: supabase/migrations/0004_prayer.sql
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- FILE: supabase/migrations/0005_seed.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 0005_seed.sql — default life areas for every new user
-- Trigger on auth.users insert creates profile + settings + seeded areas.
-- Also installs the notification cron job (spec §18).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  area text[];
  seq int := 0;
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Asia/Colombo')
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- Default life areas (spec §3.0005): {name, icon} pairs.
  foreach area in array array[
    array['University', 'student'],
    array['Career', 'briefcase'],
    array['Learning', 'book-open'],
    array['Competitions', 'trophy'],
    array['Volunteering', 'hands-clapping'],
    array['Personal Branding', 'megaphone'],
    array['Prayer', 'moon'],
    array['Karate', 'medal'],
    array['Family', 'users-three'],
    array['Eating', 'fork-knife'],
    array['Entertainment', 'film-strip'],
    array['Finance', 'currency-circle-dollar'],
    array['Personal', 'user'],
    array['Unexpected', 'lightning']
  ] loop
    seq := seq + 1;
    insert into public.areas (user_id, name, icon, sort_order)
    values (new.id, area[1], area[2], seq)
    on conflict (user_id, name) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Audit helper used by server actions and Edge Functions ──────────────────
create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_source audit_source default 'user',
  p_ai_run_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_logs (user_id, action, entity_type, entity_id, source, ai_run_id, payload)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_source, p_ai_run_id, p_payload)
  returning id into v_id;
  return v_id;
exception when others then
  -- Auditing must never break the primary operation.
  return null;
end;
$$;

revoke all on function public.write_audit(text, text, uuid, audit_source, uuid, jsonb) from public;
grant execute on function public.write_audit(text, text, uuid, audit_source, uuid, jsonb) to authenticated;

-- ── Notifications: pg_cron job inserting upcoming reminders ─────────────────
-- Runs every minute; inserts notification rows for events/tasks starting or
-- due within the user's configured lead time. Idempotent per (entity, lead).
create or replace function public.schedule_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  lead interval;
begin
  for r in
    select
      e.user_id,
      e.id,
      e.title,
      e.start_at,
      coalesce((s.notification_prefs ->> 'lead_minutes')::int, 15) as lead_min
    from public.events e
    join public.settings s on s.user_id = e.user_id
    where e.status = 'scheduled'
      and coalesce((s.notification_prefs -> 'reminders')::boolean, true)
      and e.start_at > now()
      and e.start_at <= now() + interval '1 day'
      and (s.notification_prefs -> 'categories' ->> 'events')::boolean is distinct from false
  loop
    lead := make_interval(mins => r.lead_min);
    insert into public.notifications (user_id, title, body, scheduled_at, entity_type, entity_id)
    values (
      r.user_id,
      r.title,
      'Starts in ' || r.lead_min || ' minutes',
      r.start_at - lead,
      'event',
      r.id
    )
    on conflict do nothing;
  end loop;

  -- Mark due notifications as sent.
  update public.notifications
  set sent_at = now()
  where sent_at is null
    and scheduled_at <= now();
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('shanaya-notifications', '* * * * *', 'select public.schedule_notifications()');
  end if;
exception when others then
  -- pg_cron unavailable in local dev; the job installs on hosted Supabase.
  null;
end;
$$;


-- ----------------------------------------------------------------------------
-- FILE: supabase/migrations/0006_branding_family.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 0006_branding_family.sql
-- The module list (§13) requires Personal Branding content pipeline and a
-- Family module, but 0001 has no tables for them. These complete the set and
-- inherit the same RLS pattern.
-- ============================================================================

create type branding_platform as enum ('linkedin', 'github', 'portfolio');
create type branding_status as enum ('idea', 'draft', 'ready', 'published', 'archived');
create type family_kind as enum ('gathering', 'visit', 'task', 'celebration', 'other');

create table public.branding_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform branding_platform not null,
  title text not null,
  status branding_status not null default 'idea',
  url text,
  notes text,
  published_at timestamptz,
  source_capture_id uuid references public.captures (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Snapshots of platform numbers the user records manually (never invented).
create table public.branding_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform branding_platform not null,
  metric_date date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, metric_date)
);

create table public.family_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind family_kind not null default 'other',
  event_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS (same own-rows pattern).
do $$
declare t text;
begin
  foreach t in array array['branding_content', 'branding_metrics', 'family_events'] loop
    perform public.apply_own_rows_policy(format('public.%I', t));
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    perform public.apply_updated_at(format('public.%I', t));
  end loop;
end;
$$;

create index branding_content_user_idx on public.branding_content (user_id, status);
create index family_events_user_date_idx on public.family_events (user_id, event_date);


