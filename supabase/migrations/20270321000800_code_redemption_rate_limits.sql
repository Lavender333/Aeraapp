-- Trusted edge-function storage for organization-code abuse controls.
create table if not exists public.organization_code_redemption_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_fingerprint text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_fingerprint)
);

alter table public.organization_code_redemption_limits enable row level security;
revoke all on table public.organization_code_redemption_limits from public, anon, authenticated;

create index if not exists organization_code_redemption_limits_cleanup_idx
  on public.organization_code_redemption_limits(updated_at);

comment on table public.organization_code_redemption_limits is
  'Service-role-only failed redemption counters keyed by authenticated user and a one-way client/IP fingerprint.';
