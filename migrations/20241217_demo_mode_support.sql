-- Add is_demo flag to users table
alter table if exists users
  add column if not exists is_demo boolean not null default false;

-- Add is_demo flag to all data tables
alter table if exists patients
  add column if not exists is_demo boolean not null default false;

alter table if exists appointments
  add column if not exists is_demo boolean not null default false;

alter table if exists deals
  add column if not exists is_demo boolean not null default false;

alter table if exists emails
  add column if not exists is_demo boolean not null default false;

alter table if exists whatsapp_messages
  add column if not exists is_demo boolean not null default false;

alter table if exists documents
  add column if not exists is_demo boolean not null default false;

alter table if exists patient_notes
  add column if not exists is_demo boolean not null default false;

alter table if exists tasks
  add column if not exists is_demo boolean not null default false;

alter table if exists consultations
  add column if not exists is_demo boolean not null default false;

alter table if exists workflows
  add column if not exists is_demo boolean not null default false;

alter table if exists email_templates
  add column if not exists is_demo boolean not null default false;

alter table if exists providers
  add column if not exists is_demo boolean not null default false;

alter table if exists deal_stages
  add column if not exists is_demo boolean not null default false;

alter table if exists chat_conversations
  add column if not exists is_demo boolean not null default false;

alter table if exists chat_messages
  add column if not exists is_demo boolean not null default false;

-- Create indexes for demo filtering
create index if not exists patients_is_demo_idx on patients(is_demo);
create index if not exists appointments_is_demo_idx on appointments(is_demo);
create index if not exists deals_is_demo_idx on deals(is_demo);
create index if not exists emails_is_demo_idx on emails(is_demo);
create index if not exists tasks_is_demo_idx on tasks(is_demo);
create index if not exists users_is_demo_idx on users(is_demo);

-- Create function to get current user's demo status
create or replace function is_current_user_demo()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_demo from users where id = auth.uid()),
    false
  );
$$;

-- Create helper function to check if user should see demo data
create or replace function should_see_demo_data()
returns boolean
language sql
security definer
stable
as $$
  select is_current_user_demo();
$$;
