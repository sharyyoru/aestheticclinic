-- Retell AI Voice Call Integration
-- Stores scheduled outbound calls and their outcomes

-- Scheduled calls queue (dispatcher reads this every minute)
create table if not exists retell_scheduled_calls (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'dispatched', 'failed', 'cancelled')),
  -- Retell dynamic variables
  user_name text not null,       -- patient first name passed to agent
  service_name text not null,    -- deal service name passed to agent
  to_number text not null,       -- patient phone number (E.164)
  -- Retell response
  retell_call_id text,
  error_message text,
  created_at timestamptz default now(),
  dispatched_at timestamptz
);

create index if not exists retell_scheduled_calls_status_scheduled_idx
  on retell_scheduled_calls(status, scheduled_for);
create index if not exists retell_scheduled_calls_patient_id_idx
  on retell_scheduled_calls(patient_id);

-- Full call log / outcome (populated by Retell webhook)
create table if not exists retell_call_logs (
  id uuid primary key default gen_random_uuid(),
  retell_call_id text not null unique,
  patient_id uuid references patients(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  scheduled_call_id uuid references retell_scheduled_calls(id) on delete set null,
  event_type text,               -- e.g. call_started, call_ended, call_analyzed
  call_status text,              -- e.g. completed, no-answer, busy, failed
  duration_seconds integer,
  transcript text,
  call_summary text,
  recording_url text,
  raw_payload jsonb,
  created_at timestamptz default now()
);

create index if not exists retell_call_logs_patient_id_idx
  on retell_call_logs(patient_id);
create index if not exists retell_call_logs_retell_call_id_idx
  on retell_call_logs(retell_call_id);
