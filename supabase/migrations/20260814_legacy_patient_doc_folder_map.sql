-- Cache the relationship between current patients and legacy patient-docs
-- folders so the application never needs to list the entire storage bucket.
create table if not exists public.legacy_patient_doc_folders (
  patient_id uuid not null references public.patients(id) on delete cascade,
  folder_name text not null,
  created_at timestamptz not null default now(),
  primary key (patient_id, folder_name)
);

alter table public.legacy_patient_doc_folders enable row level security;

create index if not exists legacy_patient_doc_folders_folder_name_idx
  on public.legacy_patient_doc_folders(folder_name);

create or replace function public.refresh_legacy_patient_doc_folders()
returns bigint
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  mapped_count bigint;
begin
  truncate table public.legacy_patient_doc_folders;

  with folders as (
    select distinct split_part(name, '/', 1) as folder_name
    from storage.objects
    where bucket_id = 'patient-docs'
  ),
  parsed as (
    select
      folder_name,
      split_part(folder_name, '_', 2) as first_name,
      split_part(folder_name, '_', 3) as last_name,
      case
        when split_part(folder_name, '_', 4) ~ '^\d{2}-\d{2}-\d{4}$'
          then to_date(split_part(folder_name, '_', 4), 'DD-MM-YYYY')
        else null
      end as dob
    from folders
  )
  insert into public.legacy_patient_doc_folders (patient_id, folder_name)
  select distinct p.id, parsed.folder_name
  from parsed
  join public.patients p
    on regexp_replace(lower(coalesce(p.first_name, '')), '[^a-z0-9]', '', 'g')
       = regexp_replace(lower(parsed.first_name), '[^a-z0-9]', '', 'g')
   and regexp_replace(lower(coalesce(p.last_name, '')), '[^a-z0-9]', '', 'g')
       = regexp_replace(lower(parsed.last_name), '[^a-z0-9]', '', 'g')
   and (parsed.dob is null or p.dob = parsed.dob)
  on conflict do nothing;

  get diagnostics mapped_count = row_count;
  return mapped_count;
end;
$$;

revoke all on function public.refresh_legacy_patient_doc_folders() from public;
revoke all on function public.refresh_legacy_patient_doc_folders() from anon;
revoke all on function public.refresh_legacy_patient_doc_folders() from authenticated;
grant execute on function public.refresh_legacy_patient_doc_folders() to service_role;

select public.refresh_legacy_patient_doc_folders();
