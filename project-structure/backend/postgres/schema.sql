create extension if not exists pgcrypto;

create table if not exists rack_telemetry_live (
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
  constraint rack_telemetry_live_rack_slot_nonempty
    check (length(trim(rack_id)) > 0)
);

create table if not exists rack_current_state (
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
  constraint rack_current_state_rack_slot_nonempty
    check (length(trim(rack_id)) > 0)
);

create table if not exists rack_telemetry_archive (
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
  constraint rack_telemetry_archive_rack_slot_nonempty
    check (length(trim(rack_id)) > 0)
);

create index if not exists idx_rtl_rack_slot_time
  on rack_telemetry_live (rack_id, slot_id, event_time desc);
create index if not exists idx_rtl_event_time
  on rack_telemetry_live (event_time desc);
create index if not exists idx_rta_event_time
  on rack_telemetry_archive (event_time desc);
create index if not exists idx_rcs_rack_slot
  on rack_current_state (rack_id, slot_id);

create or replace function update_rack_current_state_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rack_current_state_updated_at on rack_current_state;
create trigger trg_rack_current_state_updated_at
before update on rack_current_state
for each row execute function update_rack_current_state_timestamp();

create or replace function archive_and_trim_rack_telemetry()
returns void
language plpgsql
as $$
begin
  insert into rack_telemetry_archive (
    id, rack_id, slot_id, owner_id, ingredient, tag_uid, weight_grams,
    status, event_time, mongo_device_id, metadata, created_at
  )
  select
    id, rack_id, slot_id, owner_id, ingredient, tag_uid, weight_grams,
    status, event_time, mongo_device_id, metadata, created_at
  from rack_telemetry_live
  where event_time < now() - interval '1 hour'
  on conflict (id) do nothing;

  delete from rack_telemetry_live
  where event_time < now() - interval '1 hour';

  delete from rack_telemetry_archive
  where event_time < now() - interval '3 hours';
end;
$$;