-- Persist aggregate output and governance records produced by the nightly
-- Level 3 pipeline. The pipeline authenticates with the service-role key;
-- authenticated users only receive the limited read access defined below.

begin;

create table if not exists public.region_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  snapshot_window_days integer not null default 30,
  organization_id uuid references public.organizations(id) on delete set null,
  county_id text not null,
  state_id text not null,
  region_id uuid,
  profile_count integer not null default 0,
  avg_risk_score numeric(8, 4) not null default 0,
  max_risk_score numeric(8, 4) not null default 0,
  min_risk_score numeric(8, 4) not null default 0,
  risk_growth_pct numeric(10, 4) default 0,
  drift_value numeric(10, 4) default 0,
  drift_status text default 'STABLE',
  kmeans_cluster integer,
  dbscan_cluster integer,
  anomaly_count integer default 0,
  projection_14d numeric(10, 4),
  model_version text not null,
  pipeline_run_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_region_snapshots_date
  on public.region_snapshots(snapshot_date desc);
create index if not exists idx_region_snapshots_county_state
  on public.region_snapshots(county_id, state_id);
create index if not exists idx_region_snapshots_org
  on public.region_snapshots(organization_id);
create index if not exists idx_region_snapshots_drift
  on public.region_snapshots(drift_status, drift_value desc);
create unique index if not exists idx_region_snapshots_unique_scope
  on public.region_snapshots (
    snapshot_date,
    county_id,
    state_id,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- geography_regions is part of the wider state-ready schema and may be
-- installed separately. Add its relationship whenever that table exists.
do $$
begin
  if to_regclass('public.geography_regions') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'region_snapshots_region_id_fkey'
         and conrelid = 'public.region_snapshots'::regclass
     ) then
    alter table public.region_snapshots
      add constraint region_snapshots_region_id_fkey
      foreign key (region_id)
      references public.geography_regions(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.model_audit_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  model_name text not null,
  model_version text not null,
  stage text not null,
  status text not null default 'SUCCESS',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  processed_records integer default 0,
  feature_set jsonb default '[]'::jsonb,
  metrics jsonb default '{}'::jsonb,
  error_message text,
  initiated_by text default 'nightly_pipeline',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_model_audit_run
  on public.model_audit_log(run_id, created_at desc);
create index if not exists idx_model_audit_stage
  on public.model_audit_log(stage, status, created_at desc);

alter table public.region_snapshots enable row level security;
alter table public.model_audit_log enable row level security;

revoke all on table public.region_snapshots from anon;
revoke all on table public.model_audit_log from anon;
grant select on table public.region_snapshots to authenticated;
grant select on table public.model_audit_log to authenticated;
grant all on table public.region_snapshots to service_role;
grant all on table public.model_audit_log to service_role;

drop policy if exists "authorized admins read region snapshots"
  on public.region_snapshots;
create policy "authorized admins read region snapshots"
  on public.region_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and upper(coalesce(actor.role::text, '')) in (
          'ADMIN',
          'STATE_ADMIN',
          'COUNTY_ADMIN',
          'ORG_ADMIN',
          'INSTITUTION_ADMIN'
        )
        and (
          upper(coalesce(actor.role::text, '')) in (
            'ADMIN',
            'STATE_ADMIN',
            'COUNTY_ADMIN'
          )
          or actor.org_id = region_snapshots.organization_id
        )
    )
  );

drop policy if exists "authorized admins read model audit log"
  on public.model_audit_log;
create policy "authorized admins read model audit log"
  on public.model_audit_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and upper(coalesce(actor.role::text, '')) in (
          'ADMIN',
          'STATE_ADMIN',
          'COUNTY_ADMIN'
        )
    )
  );

comment on table public.region_snapshots is
  'Daily Level 3 analytics snapshots by organization, county, and state.';
comment on table public.model_audit_log is
  'Execution and governance log for the nightly Level 3 pipeline.';

commit;
