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
