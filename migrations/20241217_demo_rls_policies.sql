-- Row Level Security policies to automatically filter demo vs real data
-- This ensures users only see data matching their demo status

-- Enable RLS on all demo-enabled tables
alter table patients enable row level security;
alter table appointments enable row level security;
alter table deals enable row level security;
alter table emails enable row level security;
alter table whatsapp_messages enable row level security;
alter table documents enable row level security;
alter table patient_notes enable row level security;
alter table tasks enable row level security;
alter table consultations enable row level security;
alter table workflows enable row level security;
alter table email_templates enable row level security;
alter table providers enable row level security;
alter table deal_stages enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;

-- Drop existing policies if they exist
drop policy if exists "patients_demo_isolation" on patients;
drop policy if exists "appointments_demo_isolation" on appointments;
drop policy if exists "deals_demo_isolation" on deals;
drop policy if exists "emails_demo_isolation" on emails;
drop policy if exists "whatsapp_messages_demo_isolation" on whatsapp_messages;
drop policy if exists "documents_demo_isolation" on documents;
drop policy if exists "patient_notes_demo_isolation" on patient_notes;
drop policy if exists "tasks_demo_isolation" on tasks;
drop policy if exists "consultations_demo_isolation" on consultations;
drop policy if exists "workflows_demo_isolation" on workflows;
drop policy if exists "email_templates_demo_isolation" on email_templates;
drop policy if exists "providers_demo_isolation" on providers;
drop policy if exists "deal_stages_demo_isolation" on deal_stages;
drop policy if exists "chat_conversations_demo_isolation" on chat_conversations;
drop policy if exists "chat_messages_demo_isolation" on chat_messages;

-- Create RLS policies to filter by demo status
create policy "patients_demo_isolation" on patients
  for all
  using (is_demo = is_current_user_demo());

create policy "appointments_demo_isolation" on appointments
  for all
  using (is_demo = is_current_user_demo());

create policy "deals_demo_isolation" on deals
  for all
  using (is_demo = is_current_user_demo());

create policy "emails_demo_isolation" on emails
  for all
  using (is_demo = is_current_user_demo());

create policy "whatsapp_messages_demo_isolation" on whatsapp_messages
  for all
  using (is_demo = is_current_user_demo());

create policy "documents_demo_isolation" on documents
  for all
  using (is_demo = is_current_user_demo());

create policy "patient_notes_demo_isolation" on patient_notes
  for all
  using (is_demo = is_current_user_demo());

create policy "tasks_demo_isolation" on tasks
  for all
  using (is_demo = is_current_user_demo());

create policy "consultations_demo_isolation" on consultations
  for all
  using (is_demo = is_current_user_demo());

create policy "workflows_demo_isolation" on workflows
  for all
  using (is_demo = is_current_user_demo());

create policy "email_templates_demo_isolation" on email_templates
  for all
  using (is_demo = is_current_user_demo());

create policy "providers_demo_isolation" on providers
  for all
  using (is_demo = is_current_user_demo());

create policy "deal_stages_demo_isolation" on deal_stages
  for all
  using (is_demo = is_current_user_demo());

create policy "chat_conversations_demo_isolation" on chat_conversations
  for all
  using (is_demo = is_current_user_demo());

create policy "chat_messages_demo_isolation" on chat_messages
  for all
  using (
    exists (
      select 1 from chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
      and chat_conversations.is_demo = is_current_user_demo()
    )
  );
