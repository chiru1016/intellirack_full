create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- Keep the public schema accessible for Supabase anon/authenticated reads where needed.
grant usage on schema public to anon, authenticated;

create table if not exists public.rack_telemetry_live (
  id uuid primary key default gen_random_uuid(),
  rack_id text not null,
  slot_id integer not null check (slot_id between 1 and 9),
  owner_id text,
  ingredient text,
  tag_uid text,
  weight_grams double precision,
  status text,
  event_time timestamptz not null,
  mongo_device_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rack_telemetry_live_rack_slot_nonempty check (length(trim(rack_id)) > 0)
);

create table if not exists public.rack_telemetry_archive (
  id uuid primary key,
  rack_id text not null,
  slot_id integer not null check (slot_id between 1 and 9),
  owner_id text,
  ingredient text,
  tag_uid text,
  weight_grams double precision,
  status text,
  event_time timestamptz not null,
  mongo_device_id text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now(),
  created_at timestamptz not null,
  constraint rack_telemetry_archive_rack_slot_nonempty check (length(trim(rack_id)) > 0)
);

create table if not exists public.rack_current_state (
  rack_id text not null,
  slot_id integer not null check (slot_id between 1 and 9),
  owner_id text,
  ingredient text,
  tag_uid text,
  weight_grams double precision,
  status text,
  event_time timestamptz not null,
  mongo_device_id text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (rack_id, slot_id),
  constraint rack_current_state_rack_slot_nonempty check (length(trim(rack_id)) > 0)
);

create index if not exists idx_rtl_rack_slot_time
  on public.rack_telemetry_live (rack_id, slot_id, event_time desc);

create index if not exists idx_rtl_event_time
  on public.rack_telemetry_live (event_time desc);

create index if not exists idx_rta_event_time
  on public.rack_telemetry_archive (event_time desc);

create index if not exists idx_rta_archived_at
  on public.rack_telemetry_archive (archived_at desc);

create index if not exists idx_rcs_owner
  on public.rack_current_state (owner_id, rack_id, slot_id);

create index if not exists idx_rcs_rack_slot
  on public.rack_current_state (rack_id, slot_id);

create or replace function public.upsert_rack_current_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rack_current_state_updated_at on public.rack_current_state;
create trigger trg_rack_current_state_updated_at
before update on public.rack_current_state
for each row execute function public.upsert_rack_current_state_updated_at();

create or replace view public.rack_twin_current
with (security_invoker = true)
as
select
  rack_id,
  slot_id,
  owner_id,
  ingredient,
  tag_uid,
  weight_grams,
  status,
  event_time,
  mongo_device_id,
  metadata,
  updated_at
from public.rack_current_state;

create or replace function public.get_rack_twin_state(p_rack_id text)
returns table (
  rack_id text,
  slot_id integer,
  owner_id text,
  ingredient text,
  tag_uid text,
  weight_grams double precision,
  status text,
  event_time timestamptz,
  mongo_device_id text,
  metadata jsonb,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    rcs.rack_id,
    rcs.slot_id,
    rcs.owner_id,
    rcs.ingredient,
    rcs.tag_uid,
    rcs.weight_grams,
    rcs.status,
    rcs.event_time,
    rcs.mongo_device_id,
    rcs.metadata,
    rcs.updated_at
  from public.rack_current_state rcs
  where rcs.rack_id = p_rack_id
  order by rcs.slot_id asc;
$$;

create or replace function public.archive_and_trim_rack_telemetry()
returns void
language plpgsql
as $$
begin
  insert into public.rack_telemetry_archive (
    id,
    rack_id,
    slot_id,
    owner_id,
    ingredient,
    tag_uid,
    weight_grams,
    status,
    event_time,
    mongo_device_id,
    metadata,
    created_at
  )
  select
    rtl.id,
    rtl.rack_id,
    rtl.slot_id,
    rtl.owner_id,
    rtl.ingredient,
    rtl.tag_uid,
    rtl.weight_grams,
    rtl.status,
    rtl.event_time,
    rtl.mongo_device_id,
    rtl.metadata,
    rtl.created_at
  from public.rack_telemetry_live rtl
  where rtl.event_time < now() - interval '1 hour'
  on conflict (id) do nothing;

  delete from public.rack_telemetry_live
  where event_time < now() - interval '1 hour';

  delete from public.rack_telemetry_archive
  where event_time < now() - interval '3 hours';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'archive-and-trim-rack-telemetry'
  ) then
    perform cron.schedule(
      'archive-and-trim-rack-telemetry',
      '*/5 * * * *',
      'select public.archive_and_trim_rack_telemetry();'
    );
  end if;
end
$$;

alter table public.rack_telemetry_live enable row level security;
alter table public.rack_telemetry_archive enable row level security;
alter table public.rack_current_state enable row level security;

-- Direct twin reads are allowed against the current-state table/view.
drop policy if exists rack_current_state_public_read on public.rack_current_state;
create policy rack_current_state_public_read
on public.rack_current_state
for select
using (true);

drop policy if exists rack_twin_current_public_read on public.rack_current_state;

-- History stays restricted to owner-backed reads; writes come from the service role.
drop policy if exists rack_live_owner_read on public.rack_telemetry_live;
create policy rack_live_owner_read
on public.rack_telemetry_live
for select
using (owner_id = auth.uid()::text);

drop policy if exists rack_archive_owner_read on public.rack_telemetry_archive;
create policy rack_archive_owner_read
on public.rack_telemetry_archive
for select
using (owner_id = auth.uid()::text);

drop policy if exists rack_live_service_write on public.rack_telemetry_live;
create policy rack_live_service_write
on public.rack_telemetry_live
for insert
with check (auth.role() = 'service_role');

drop policy if exists rack_state_service_write on public.rack_current_state;
create policy rack_state_service_write
on public.rack_current_state
for insert
with check (auth.role() = 'service_role');

drop policy if exists rack_state_service_update on public.rack_current_state;
create policy rack_state_service_update
on public.rack_current_state
for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant select on public.rack_current_state to anon, authenticated;
grant select on public.rack_twin_current to anon, authenticated;
grant execute on function public.get_rack_twin_state(text) to anon, authenticated;
