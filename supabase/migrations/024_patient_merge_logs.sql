-- Patient merge activity logs for tracking all merge operations
create table if not exists patient_merge_logs (
  id uuid primary key default gen_random_uuid(),
  
  -- Primary patient (the one that remains)
  primary_patient_id uuid not null,
  primary_patient_name text,
  
  -- Merged patients (the ones that were deleted)
  merged_patient_ids uuid[] not null,
  merged_patient_names text[],
  
  -- User who performed the merge
  performed_by_user_id uuid references users(id) on delete set null,
  performed_by_name text,
  
  -- Merge details
  tables_updated text[] not null default '{}',
  files_copied integer not null default 0,
  file_mappings jsonb default '[]',
  
  -- Status
  status text not null check (status in ('success', 'partial', 'failed')) default 'success',
  error_message text,
  
  -- Timestamps
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes for efficient querying
create index if not exists patient_merge_logs_primary_patient_idx 
  on patient_merge_logs(primary_patient_id);
  
create index if not exists patient_merge_logs_performed_by_idx 
  on patient_merge_logs(performed_by_user_id);
  
create index if not exists patient_merge_logs_created_at_idx 
  on patient_merge_logs(created_at desc);

-- Index on merged patient IDs array for checking if a patient was merged
create index if not exists patient_merge_logs_merged_ids_idx 
  on patient_merge_logs using gin(merged_patient_ids);

-- RLS policies
alter table patient_merge_logs enable row level security;

-- Allow authenticated users to view merge logs
create policy "Users can view merge logs"
  on patient_merge_logs for select
  to authenticated
  using (true);

-- Allow authenticated users to create merge logs
create policy "Users can create merge logs"
  on patient_merge_logs for insert
  to authenticated
  with check (true);

-- Allow users to update their own merge logs
create policy "Users can update their own merge logs"
  on patient_merge_logs for update
  to authenticated
  using (performed_by_user_id = auth.uid());

-- Comment on table
comment on table patient_merge_logs is 'Tracks all patient merge operations for audit and recovery purposes';
