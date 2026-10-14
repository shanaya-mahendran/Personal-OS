-- ============================================================================
-- 0001_init.sql — Shanaya OS core schema
-- Every user-owned table carries user_id + created_at/updated_at with a
-- shared touch trigger.
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type event_status as enum ('scheduled', 'cancelled', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'capture_input_type') then
    create type capture_input_type as enum ('text', 'image', 'voice', 'document', 'paste');
  end if;
  if not exists (select 1 from pg_type where typname = 'capture_status') then
    create type capture_status as enum ('pending', 'processing', 'awaiting_confirmation', 'confirmed', 'rejected', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'memory_kind') then
    create type memory_kind as enum ('decision', 'lesson', 'preference', 'fact', 'experience');
  end if;
  if not exists (select 1 from pg_type where typname = 'prayer_name') then
    create type prayer_name as enum ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha');
  end if;
  if not exists (select 1 from pg_type where typname = 'career_type') then
    create type career_type as enum ('internship', 'full_time', 'part_time', 'contract');
  end if;
  if not exists (select 1 from pg_type where typname = 'work_mode') then
    create type work_mode as enum ('remote', 'hybrid', 'onsite');
  end if;
  if not exists (select 1 from pg_type where typname = 'career_status') then
    create type career_status as enum ('saved', 'applied', 'screening', 'interview', 'technical', 'offer', 'accepted', 'rejected', 'withdrawn');
  end if;
  if not exists (select 1 from pg_type where typname = 'meal_type') then
    create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
  end if;
  if not exists (select 1 from pg_type where typname = 'karate_focus') then
    create type karate_focus as enum ('kata', 'kumite', 'conditioning', 'technique', 'grading', 'competition');
  end if;
  if not exists (select 1 from pg_type where typname = 'entertainment_category') then
    create type entertainment_category as enum ('movie', 'tv', 'anime', 'game', 'music', 'youtube', 'book', 'social');
  end if;
  if not exists (select 1 from pg_type where typname = 'music_mood') then
    create type music_mood as enum ('focus', 'calm', 'energetic', 'happy', 'sad', 'social', 'travel', 'custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'idea_status') then
    create type idea_status as enum ('seed', 'exploring', 'parked', 'promoted');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type project_status as enum ('active', 'paused', 'done', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_source') then
    create type audit_source as enum ('user', 'ai', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'chat_role') then
    create type chat_role as enum ('user', 'assistant');
  end if;
end;
$$;

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
execute format(
  'create trigger set_updated_at before update on %s for each row execute function public.set_updated_at()',
  target
);
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
