alter table if exists swiss_insurers
  add column if not exists contact_email text;

create index if not exists swiss_insurers_contact_email_idx
  on swiss_insurers(contact_email)
  where contact_email is not null;
