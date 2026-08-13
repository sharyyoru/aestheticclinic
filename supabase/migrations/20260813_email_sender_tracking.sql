-- Track the authenticated clinic user responsible for an outbound email.
-- Inbound reply handling uses this value to notify the correct staff member.
alter table public.emails
  add column if not exists sent_by_user_id uuid
  references public.users(id) on delete set null;

create index if not exists emails_sent_by_user_id_idx
  on public.emails(sent_by_user_id)
  where sent_by_user_id is not null;

comment on column public.emails.sent_by_user_id is
  'Clinic user responsible for the outbound email and recipient of patient reply notifications.';
