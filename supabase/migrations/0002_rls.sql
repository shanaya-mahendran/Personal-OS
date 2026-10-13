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
