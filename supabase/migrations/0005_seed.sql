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
