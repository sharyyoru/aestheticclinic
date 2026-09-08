-- Repair legacy online bookings using the verified short booking label.
-- Never overwrite a stored owner or guess when the user name is ambiguous.
update public.appointments a
set doctor_user_id = u.id
from public.users u
where a.doctor_user_id is null
  and lower(trim(u.full_name)) = 'ekaterina iosipoi'
  and lower(trim((regexp_match(a.reason, '\[Doctor:\s*([^]]+)\]', 'i'))[1])) = 'ekaterina'
  and (select count(*) from public.users candidate
       where lower(trim(candidate.full_name)) = 'ekaterina iosipoi') = 1;
