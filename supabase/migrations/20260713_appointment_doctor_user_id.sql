alter table public.appointments
  add column if not exists doctor_user_id uuid references public.users(id) on delete set null;

create index if not exists appointments_doctor_user_id_idx
  on public.appointments(doctor_user_id);

comment on column public.appointments.doctor_user_id is
  'Stable calendar owner. provider_id remains reserved for the providers billing table.';

-- Backfill only unambiguous, exact active-name matches. The application keeps
-- a normalized legacy fallback for spelling variants such as Cesar/Cezar.
update public.appointments a
set doctor_user_id = u.id
from public.users u
where a.doctor_user_id is null
  and a.reason ~* '\[Doctor:\s*[^]]+\]'
  and lower(trim(u.full_name)) = lower(trim((regexp_match(a.reason, '\[Doctor:\s*([^]]+)\]', 'i'))[1]))
  and lower(u.full_name) not like '%deactivated%'
  and not exists (
    select 1 from public.users duplicate
    where duplicate.id <> u.id
      and lower(trim(duplicate.full_name)) = lower(trim(u.full_name))
      and lower(duplicate.full_name) not like '%deactivated%'
  );
